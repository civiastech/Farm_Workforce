import type { Language } from "@fwp/shared";

/**
 * SMS wording in each interface language. Written without tone marks or special letters on
 * purpose: they force the expensive UCS-2 encoding (70 characters per SMS instead of 160).
 * Placeholders: {code}, {minutes}, {days}, {n}, {employer}, {job}, {url}.
 */
interface SmsTemplates {
  code: string;
  shortlisted: string;
  hired: string;
  rejected: string;
  jobExpired: string;
  newApplicants: string;
}

const SMS: Record<Language, SmsTemplates> = {
  en: {
    code: "{code} is your Farm Workforce code. It expires in {minutes} minutes. Never share it with anyone.",
    shortlisted: 'Farm Workforce: {employer} shortlisted you for "{job}". They may call you on this number.',
    hired: 'Farm Workforce: Congratulations! {employer} hired you for "{job}".',
    rejected: 'Farm Workforce: {employer} did not select you for "{job}". See new jobs: {url}',
    jobExpired: 'Farm Workforce: your job "{job}" closed after {days} days. Reopen it at {url}',
    newApplicants: "Farm Workforce: you have new applicants ({n}). Review them at {url}",
  },
  pcm: {
    code: "{code} na your Farm Workforce code. E go expire for {minutes} minutes. No show anybody.",
    shortlisted:
      'Farm Workforce: {employer} don shortlist you for "{job}". Dem fit call you for this number.',
    hired: 'Farm Workforce: Congrats! {employer} don hire you for "{job}".',
    rejected: 'Farm Workforce: {employer} no pick you for "{job}". Check new jobs: {url}',
    jobExpired: 'Farm Workforce: your job "{job}" don close after {days} days. Open am again for {url}',
    newApplicants: "Farm Workforce: new people don apply for your jobs ({n}). Check dem for {url}",
  },
  ha: {
    code: "{code} ita ce lambar Farm Workforce dinka. Za ta kare cikin minti {minutes}. Kada ka nuna wa kowa.",
    shortlisted: 'Farm Workforce: {employer} ya zabe ka don "{job}". Za su iya kiran ka a wannan lamba.',
    hired: 'Farm Workforce: Barka! {employer} ya dauke ka aiki don "{job}".',
    rejected: 'Farm Workforce: {employer} bai zabe ka don "{job}" ba. Duba sababbin ayyuka: {url}',
    jobExpired: 'Farm Workforce: aikinka "{job}" ya rufe bayan kwana {days}. Sake bude shi a {url}',
    newApplicants: "Farm Workforce: sababbin masu nema sun zo ({n}). Duba su a {url}",
  },
  yo: {
    code: "{code} ni koodu Farm Workforce re. Yoo pari ni iseju {minutes}. Ma fi han enikeni.",
    shortlisted: 'Farm Workforce: {employer} ti yan o fun "{job}". Won le pe o lori nomba yii.',
    hired: 'Farm Workforce: E ku oriire! {employer} ti gba o sise fun "{job}".',
    rejected: 'Farm Workforce: {employer} ko yan o fun "{job}". Wo ise tuntun: {url}',
    jobExpired: 'Farm Workforce: ise re "{job}" ti pa leyin ojo {days}. Si i pada ni {url}',
    newApplicants: "Farm Workforce: awon olubeere tuntun ({n}) ti de. Wo won ni {url}",
  },
  ig: {
    code: "{code} bu koodu Farm Workforce gi. O ga-agwu na nkeji {minutes}. Egosila onye obula.",
    shortlisted: 'Farm Workforce: {employer} ahoputala gi maka "{job}". Ha nwere ike ikpo gi na nomba a.',
    hired: 'Farm Workforce: Ekele! {employer} ewerela gi n\'oru maka "{job}".',
    rejected: 'Farm Workforce: {employer} ahoroghi gi maka "{job}". Lee oru ohuru: {url}',
    jobExpired: 'Farm Workforce: oru gi "{job}" emechiela mgbe ubochi {days} gasiri. Megharia ya na {url}',
    newApplicants: "Farm Workforce: ndi ohuru etinyela akwukwo ({n}). Lee ha na {url}",
  },
  fr: {
    code: "{code} est votre code Farm Workforce. Il expire dans {minutes} minutes. Ne le partagez avec personne.",
    shortlisted:
      'Farm Workforce : {employer} vous a preselectionne pour "{job}". Il peut vous appeler a ce numero.',
    hired: 'Farm Workforce : Felicitations ! {employer} vous a embauche pour "{job}".',
    rejected:
      'Farm Workforce : {employer} n\'a pas retenu votre candidature pour "{job}". Nouvelles offres : {url}',
    jobExpired: 'Farm Workforce : votre offre "{job}" a ete fermee apres {days} jours. Rouvrez-la sur {url}',
    newApplicants: "Farm Workforce : nouvelles candidatures ({n}). Consultez-les sur {url}",
  },
};

/** Keeps user-written names short so the whole message fits in one or two SMS. */
function clip(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function smsText(
  language: Language,
  key: keyof SmsTemplates,
  values: {
    code?: string;
    minutes?: number;
    days?: number;
    n?: number;
    employer?: string;
    job?: string;
    url?: string;
  },
): string {
  const template = SMS[language][key] ?? SMS.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (name === "employer") return clip(values.employer ?? "", 30);
    if (name === "job") return clip(values.job ?? "", 40);
    return String(values[name as keyof typeof values] ?? "");
  });
}

/** Exposed for tests: every language must keep every placeholder. */
export const SMS_TEMPLATES = SMS;
