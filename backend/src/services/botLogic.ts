import { z } from "zod";
import { messages } from "../utils/messages";
import { ConversationStep, UserStatus } from "../utils/states";
import {
  createConversation,
  createPayment,
  createSubmission,
  getConversationByUserId,
  getLatestPaymentByUserId,
  getOrCreateUserByPhone,
  invokeNotifyAdminEdgeFunction,
  updateConversation,
  updateUserStatus
} from "./supabase";

const proceedSchema = z.string().min(1).max(20);
const planSchema = z.string().min(1).max(20);
const faqSchema = z.string().min(1).max(2);
const nonEmptySchema = z.string().min(1).max(200);
const genderChoiceSchema = z.enum(["1", "2"]);
const dobSchema = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/);
const birthTimeChoiceSchema = z.enum(["1", "2", "3"]);
const exactTimeSchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i);
const mediaUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://api.twilio.com/"));

function normalizeText(input: string | undefined) {
  return (input || "").trim();
}

function normalizeLower(input: string | undefined) {
  return normalizeText(input).toLowerCase();
}

function isLifeForecast(body: string) {
  const normalized = normalizeLower(body);
  return normalized === "1" || normalized === "life forecast";
}

function isDestinyReadings(body: string) {
  const normalized = normalizeLower(body);
  return normalized === "2" || normalized === "destiny readings";
}

function isAskQuestion(body: string) {
  const normalized = normalizeLower(body);
  return normalized === "3" || normalized === "ask a question";
}

function getServiceType(conversation: { collected_data: Record<string, unknown> }): "life_forecast" | "destiny_readings" {
  const t = conversation.collected_data._serviceType;
  return t === "destiny_readings" ? "destiny_readings" : "life_forecast";
}

function parsePlan(body: string) {
  const normalized = normalizeLower(body);
  if (["1", "1 year", "1-year", "one", "one year"].includes(normalized)) {
    return "1 Year";
  }
  if (["3", "3 years", "3-year", "three", "three years"].includes(normalized)) {
    return "3 Years";
  }
  if (["5", "5 years", "5-year", "five", "five years"].includes(normalized)) {
    return "5 Years";
  }
  return null;
}

function getStepHistory(conversation: { collected_data: Record<string, unknown> }) {
  const raw = conversation.collected_data._stepHistory;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function withStepHistory(
  conversation: { collected_data: Record<string, unknown> },
  history: string[],
  extra?: Record<string, unknown>
) {
  return {
    ...conversation.collected_data,
    ...extra,
    _stepHistory: history
  };
}

async function advanceStep(
  conversation: { id: string; current_step: string; collected_data: Record<string, unknown> },
  nextStep: ConversationStep,
  extra?: Record<string, unknown>
) {
  const history = getStepHistory(conversation);
  const nextHistory = [...history, conversation.current_step];
  await updateConversation(conversation.id, {
    collected_data: withStepHistory(conversation, nextHistory, extra),
    current_step: nextStep
  });
}

function promptForStep(
  step: ConversationStep,
  conversation: { collected_data: Record<string, unknown> } | null
) {
  const serviceType = conversation ? getServiceType(conversation) : "life_forecast";
  const isDestiny = serviceType === "destiny_readings";
  switch (step) {
    case ConversationStep.WELCOME:
      return `${messages.welcome}\n${messages.askProceed}`;
    case ConversationStep.ASK_PROCEED:
      return messages.askProceed;
    case ConversationStep.FAQ_MENU:
      return messages.faqMenu;
    case ConversationStep.PAYMENT_ISSUE_MENU:
      return messages.paymentRejectedInvalid;
    case ConversationStep.CONFIDENTIALITY:
      return isDestiny ? messages.optionsDestiny : messages.options;
    case ConversationStep.OPTIONS:
      return isDestiny ? messages.optionsDestiny : messages.options;
    case ConversationStep.WAITING_PAYMENT:
      return messages.waitingPayment;
    case ConversationStep.COLLECT_FULL_NAME:
      return messages.paymentReceived;
    case ConversationStep.COLLECT_DOB:
      return messages.askDob;
    case ConversationStep.COLLECT_BIRTH_TIME:
      return messages.askBirthTime;
    case ConversationStep.COLLECT_BIRTH_TIME_EXACT_VALUE:
      return messages.askBirthTimeExact;
    case ConversationStep.COLLECT_BIRTH_TIME_APPROX_VALUE:
      return messages.askBirthTimeApprox;
    case ConversationStep.COLLECT_BIRTH_PLACE:
      return messages.askBirthPlace;
    case ConversationStep.COLLECT_CURRENT_LOCATION:
      return messages.askCurrentLocation;
    case ConversationStep.COLLECT_GENDER:
      return messages.askGender;
    case ConversationStep.AWAITING_VERIFICATION:
      return messages.awaitingVerification;
    case ConversationStep.VERIFIED_NOTIFIED:
      return isDestiny ? messages.paymentVerifiedDestiny : messages.paymentVerified;
    case ConversationStep.COMPLETED:
      return isDestiny ? messages.completedDestiny : messages.completed;
    default:
      return messages.askProceed;
  }
}

function getNextDetailsStep(
  collected: Record<string, unknown>
): ConversationStep {
  if (!collected.full_name) return ConversationStep.COLLECT_FULL_NAME;
  if (!collected.dob) return ConversationStep.COLLECT_DOB;
  if (!collected.timeOfBirthType) return ConversationStep.COLLECT_BIRTH_TIME;
  if (
    collected.timeOfBirthType === "Exact" &&
    !collected.timeOfBirthValue
  ) {
    return ConversationStep.COLLECT_BIRTH_TIME_EXACT_VALUE;
  }
  if (
    collected.timeOfBirthType === "Approximate" &&
    !collected.timeOfBirthValue
  ) {
    return ConversationStep.COLLECT_BIRTH_TIME_APPROX_VALUE;
  }
  if (!collected.birth_place) return ConversationStep.COLLECT_BIRTH_PLACE;
  if (!collected.current_location)
    return ConversationStep.COLLECT_CURRENT_LOCATION;
  if (!collected.gender) return ConversationStep.COLLECT_GENDER;
  return ConversationStep.AWAITING_VERIFICATION;
}

export interface BotResult {
  reply: string;
}

export interface IncomingMessage {
  from: string;
  body?: string;
  numMedia: number;
  mediaUrl?: string;
}

export async function handleIncomingMessage(
  input: IncomingMessage
): Promise<BotResult> {
  // Strict state machine: replies and transitions are driven by status + step.
  const user = await getOrCreateUserByPhone(input.from);
  let conversation = await getConversationByUserId(user.id);

  if (!conversation) {
    conversation = await createConversation(user.id, ConversationStep.WELCOME);
  }

  if (user.status === UserStatus.COMPLETED) {
    const isDestiny = (user as { service_type?: string }).service_type === "destiny_readings";
    return { reply: isDestiny ? messages.completedDestiny : messages.completed };
  }

  if (user.status === UserStatus.VERIFIED) {
    const isDestiny = (user as { service_type?: string }).service_type === "destiny_readings";
    return { reply: isDestiny ? messages.paymentVerifiedDestiny : messages.paymentVerified };
  }

  const bodyText = normalizeText(input.body);
  const lowerText = normalizeLower(input.body);
  const isBack = lowerText === "0" || lowerText === "back";
  const isMenu = lowerText === "00" || lowerText === "menu";

  async function handlePaymentScreenshot(): Promise<BotResult> {
    if (!input.mediaUrl) {
      return { reply: messages.waitingPayment };
    }
    const mediaParsed = mediaUrlSchema.safeParse(input.mediaUrl);
    if (!mediaParsed.success) {
      return { reply: messages.waitingPayment };
    }
    const serviceType = getServiceType(conversation!);
    await createPayment(user.id, mediaParsed.data, serviceType);
    await updateUserStatus(user.id, UserStatus.PAYMENT_SUBMITTED);
    const nextStep = getNextDetailsStep(conversation!.collected_data);
    await advanceStep(conversation!, nextStep);
    return { reply: messages.paymentReceived };
  }

  if (isMenu) {
    await updateConversation(conversation.id, {
      collected_data: withStepHistory(conversation, []),
      current_step: ConversationStep.ASK_PROCEED
    });
    return { reply: messages.askProceed };
  }

  if (isBack) {
    const history = getStepHistory(conversation);
    const previous = history.pop();
    if (!previous) {
      await updateConversation(conversation.id, {
        collected_data: withStepHistory(conversation, []),
        current_step: ConversationStep.ASK_PROCEED
      });
      return { reply: messages.askProceed };
    }
    const previousStep = previous as ConversationStep;
    await updateConversation(conversation.id, {
      collected_data: withStepHistory(conversation, history),
      current_step: previousStep
    });
    return { reply: promptForStep(previousStep, conversation) };
  }

  if (
    input.numMedia > 0 &&
    (conversation.current_step === ConversationStep.WAITING_PAYMENT ||
      conversation.current_step === ConversationStep.PAYMENT_ISSUE_MENU)
  ) {
    return handlePaymentScreenshot();
  }

  switch (conversation.current_step) {
    case ConversationStep.WELCOME: {
      await advanceStep(conversation, ConversationStep.ASK_PROCEED);
      return { reply: `${messages.welcome}\n${messages.askProceed}` };
    }
    case ConversationStep.ASK_PROCEED: {
      const parsed = proceedSchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.askProceed };
      }
      if (isAskQuestion(parsed.data)) {
        await advanceStep(conversation, ConversationStep.FAQ_MENU);
        return { reply: messages.faqMenu };
      }
      if (isLifeForecast(parsed.data)) {
        await updateUserStatus(user.id, user.status, undefined, "life_forecast");
        await advanceStep(conversation, ConversationStep.OPTIONS, {
          _serviceType: "life_forecast"
        });
        return { reply: messages.options };
      }
      if (isDestinyReadings(parsed.data)) {
        await updateUserStatus(user.id, user.status, undefined, "destiny_readings");
        await advanceStep(conversation, ConversationStep.OPTIONS, {
          _serviceType: "destiny_readings"
        });
        return { reply: messages.optionsDestiny };
      }
      return { reply: messages.askProceed };
    }
    case ConversationStep.FAQ_MENU: {
      const parsed = faqSchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.faqMenu };
      }
      switch (parsed.data.trim()) {
        case "1":
          return { reply: `${messages.faqHowLong}\n${messages.faqMenu}` };
        case "2":
          return { reply: `${messages.faqDetailsNeeded}\n${messages.faqMenu}` };
        case "3":
          return {
            reply: `${messages.faqBirthTimeUnknown}\n${messages.faqMenu}`
          };
        case "4":
          return { reply: `${messages.faqRefund}\n${messages.faqMenu}` };
        case "5":
          await updateUserStatus(user.id, user.status, undefined, "life_forecast");
          await advanceStep(conversation, ConversationStep.OPTIONS, {
            _serviceType: "life_forecast"
          });
          return { reply: messages.options };
        case "6":
          await advanceStep(conversation, ConversationStep.ASK_PROCEED);
          return { reply: messages.askProceed };
        default:
          return { reply: messages.faqMenu };
      }
    }
    case ConversationStep.CONFIDENTIALITY: {
      await advanceStep(conversation, ConversationStep.OPTIONS);
      return { reply: messages.options };
    }
    case ConversationStep.OPTIONS: {
      const parsed = planSchema.safeParse(bodyText);
      const isDestiny = getServiceType(conversation) === "destiny_readings";
      const optionsMsg = isDestiny ? messages.optionsDestiny : messages.options;
      const paymentMsg = isDestiny ? messages.paymentInstructionsDestiny : messages.paymentInstructions;
      if (!parsed.success) {
        return { reply: optionsMsg };
      }
      const plan = parsePlan(parsed.data);
      if (!plan) {
        return { reply: optionsMsg };
      }

      await updateUserStatus(user.id, UserStatus.AWAITING_PAYMENT, plan);
      await advanceStep(conversation, ConversationStep.WAITING_PAYMENT);
      return { reply: paymentMsg };
    }
    case ConversationStep.WAITING_PAYMENT: {
      if (input.numMedia > 0) {
        return handlePaymentScreenshot();
      }
      return { reply: messages.waitingPayment };
    }
    case ConversationStep.PAYMENT_ISSUE_MENU: {
      const parsed = z.string().min(1).max(2).safeParse(bodyText.trim());
      if (!parsed.success) {
        return { reply: messages.paymentIssueInvalidOption };
      }
      if (parsed.data === "1") {
        await advanceStep(conversation, ConversationStep.WAITING_PAYMENT);
        return { reply: messages.waitingPayment };
      }
      if (parsed.data === "2") {
        return { reply: messages.paymentInstructions };
      }
      return { reply: messages.paymentIssueInvalidOption };
    }
    case ConversationStep.COLLECT_FULL_NAME: {
      const parsed = nonEmptySchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.paymentReceived };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_DOB, {
        full_name: bodyText
      });
      return { reply: messages.askDob };
    }
    case ConversationStep.COLLECT_DOB: {
      const parsed = dobSchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.askDob };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_BIRTH_TIME, {
        dob: bodyText
      });
      return { reply: messages.askBirthTime };
    }
    case ConversationStep.COLLECT_BIRTH_TIME: {
      const parsed = birthTimeChoiceSchema.safeParse(bodyText.trim());
      if (!parsed.success) {
        return { reply: messages.askBirthTime };
      }
      if (parsed.data === "1") {
        await advanceStep(
          conversation,
          ConversationStep.COLLECT_BIRTH_TIME_EXACT_VALUE,
          { timeOfBirthType: "Exact" }
        );
        return { reply: messages.askBirthTimeExact };
      }
      if (parsed.data === "2") {
        await advanceStep(
          conversation,
          ConversationStep.COLLECT_BIRTH_TIME_APPROX_VALUE,
          { timeOfBirthType: "Approximate" }
        );
        return { reply: messages.askBirthTimeApprox };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_BIRTH_PLACE, {
        timeOfBirthType: "Unknown",
        timeOfBirthValue: "Unknown"
      });
      return { reply: messages.askBirthPlace };
    }
    case ConversationStep.COLLECT_BIRTH_TIME_EXACT_VALUE: {
      const parsed = exactTimeSchema.safeParse(bodyText.trim());
      if (!parsed.success) {
        return { reply: messages.askBirthTimeExact };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_BIRTH_PLACE, {
        timeOfBirthValue: parsed.data.toUpperCase()
      });
      return { reply: messages.askBirthPlace };
    }
    case ConversationStep.COLLECT_BIRTH_TIME_APPROX_VALUE: {
      const parsed = nonEmptySchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.askBirthTimeApprox };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_BIRTH_PLACE, {
        timeOfBirthValue: parsed.data
      });
      return { reply: messages.askBirthPlace };
    }
    case ConversationStep.COLLECT_BIRTH_PLACE: {
      const parsed = nonEmptySchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.askBirthPlace };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_CURRENT_LOCATION, {
        birth_place: bodyText
      });
      return { reply: messages.askCurrentLocation };
    }
    case ConversationStep.COLLECT_CURRENT_LOCATION: {
      const parsed = nonEmptySchema.safeParse(bodyText);
      if (!parsed.success) {
        return { reply: messages.askCurrentLocation };
      }
      await advanceStep(conversation, ConversationStep.COLLECT_GENDER, {
        current_location: bodyText
      });
      return { reply: messages.askGender };
    }
    case ConversationStep.COLLECT_GENDER: {
      const parsed = genderChoiceSchema.safeParse(bodyText.trim());
      if (!parsed.success) {
        return { reply: messages.askGender };
      }
      const genderValue = parsed.data === "1" ? "Male" : "Female";
      await advanceStep(conversation, ConversationStep.AWAITING_VERIFICATION, {
        gender: genderValue
      });
      const payment = await getLatestPaymentByUserId(user.id);
      if (payment) {
        try {
          const submission = await createSubmission(
            user.id,
            conversation.id,
            payment.id
          );
          invokeNotifyAdminEdgeFunction(submission.id).catch((err) =>
            console.error("[botLogic] Admin notification failed:", err)
          );
        } catch (err) {
          console.error("[botLogic] Create submission / notify admin:", err);
        }
      }
      return { reply: messages.confirmation };
    }
    case ConversationStep.AWAITING_VERIFICATION: {
      return { reply: messages.awaitingVerification };
    }
    case ConversationStep.VERIFIED_NOTIFIED: {
      return { reply: messages.paymentVerified };
    }
    default: {
      return { reply: messages.awaitingVerification };
    }
  }
}
