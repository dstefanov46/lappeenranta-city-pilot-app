import type { Classification, Locale, Nature, ObservedEarlier } from "./report-contract";

type Copy = {
  appName: string;
  language: string;
  intro: string;
  locationTitle: string;
  locationHelp: string;
  useMyLocation: string;
  lat: string;
  lng: string;
  streetAddress: string;
  observedAt: string;
  nature: string;
  natureOther: string;
  classification: string;
  photo: string;
  photoHelp: string;
  prior: string;
  priorNote: string;
  contact: string;
  contactHelp: string;
  name: string;
  email: string;
  privacyTitle: string;
  privacyText: string;
  privacyConsent: string;
  submit: string;
  submitting: string;
  retry: string;
  newReport: string;
  successTitle: string;
  successText: string;
  reference: string;
  errorTitle: string;
  errorText: string;
  required: string;
  invalidEmail: string;
  locationRequired: string;
  locationError: string;
  natureOtherRequired: string;
  consentRequired: string;
  natureOptions: Record<Nature, string>;
  classificationOptions: Record<Classification, string>;
  priorOptions: Record<ObservedEarlier, string>;
};

export const translations: Record<Locale, Copy> = {
  en: {
    appName: "LAPPEENRANTA",
    language: "Language",
    intro: "Leak Report",
    locationTitle: "Location",
    locationHelp: "Add a map pin, a street address, or both.",
    useMyLocation: "Use my location",
    lat: "Latitude",
    lng: "Longitude",
    streetAddress: "Street address or nearby landmark",
    observedAt: "Observation time",
    nature: "Nature of observation",
    natureOther: "Describe the observation",
    classification: "Classification",
    photo: "Photo",
    photoHelp: "A photo is optional, but it helps the city assess the observation. Avoid including people or private interiors.",
    prior: "Was this observed earlier?",
    priorNote: "Earlier observation note",
    contact: "Optional contact details",
    contactHelp: "The city may use these only to clarify this report.",
    name: "Name",
    email: "Email",
    privacyTitle: "Consent and privacy",
    privacyText: "This report sends the location or address, observation time, classification, optional note, optional photo, and optional contact details to Lappeenranta. Photos and precise locations can reveal sensitive information.",
    privacyConsent: "I understand what data will be sent.",
    submit: "Submit report",
    submitting: "Submitting...",
    retry: "Retry",
    newReport: "New report",
    successTitle: "Report submitted",
    successText: "Thank you. The city pilot system received the observation.",
    reference: "Reference",
    errorTitle: "Submission failed",
    errorText: "The report was not sent. Check the details and try again.",
    required: "This field is required.",
    invalidEmail: "Enter a valid email address.",
    locationRequired: "Add a map pin or street address.",
    locationError: "Enter both latitude and longitude, or use a street address.",
    natureOtherRequired: "Describe the observation.",
    consentRequired: "Consent is required before submitting.",
    natureOptions: {
      melted_snow: "Melted snow",
      warm_ground: "Abnormally warm ground surface",
      vapor: "Vapor from ground, manhole, or vent pipe",
      water_pond: "Water pond",
      ground_depression: "Ground depression",
      other: "Something else"
    },
    classificationOptions: {
      slight_suspicion: "Slight suspicion",
      clear_deviation: "Clear deviation",
      probable_leak: "Probable district heating leak"
    },
    priorOptions: {
      yes: "Yes",
      no: "No",
      unsure: "Unsure"
    }
  },
  fi: {
    appName: "LAPPEENRANTA",
    language: "Kieli",
    intro: "Vuotoraportti",
    locationTitle: "Sijainti",
    locationHelp: "Lisää karttapiste, katuosoite tai molemmat.",
    useMyLocation: "Käytä sijaintiani",
    lat: "Leveysaste",
    lng: "Pituusaste",
    streetAddress: "Katuosoite tai läheinen maamerkki",
    observedAt: "Havaintoaika",
    nature: "Havainnon tyyppi",
    natureOther: "Kuvaile havainto",
    classification: "Luokitus",
    photo: "Kuva",
    photoHelp: "Kuva on vapaaehtoinen, mutta se auttaa kaupunkia arvioimaan havainnon. Vältä ihmisiä ja yksityisiä sisätiloja.",
    prior: "Onko tämä havaittu aiemmin?",
    priorNote: "Lisätieto aiemmasta havainnosta",
    contact: "Vapaaehtoiset yhteystiedot",
    contactHelp: "Kaupunki voi käyttää näitä vain ilmoituksen tarkentamiseen.",
    name: "Nimi",
    email: "Sähköposti",
    privacyTitle: "Suostumus ja tietosuoja",
    privacyText: "Ilmoitus lähettää sijainnin tai osoitteen, havaintoajan, luokituksen, vapaaehtoisen lisätiedon, vapaaehtoisen kuvan ja vapaaehtoiset yhteystiedot Lappeenrannalle. Kuvat ja tarkat sijainnit voivat paljastaa arkaluonteista tietoa.",
    privacyConsent: "Ymmärrän, mitä tietoja lähetetään.",
    submit: "Lähetä ilmoitus",
    submitting: "Lähetetään...",
    retry: "Yritä uudelleen",
    newReport: "Uusi ilmoitus",
    successTitle: "Ilmoitus lähetetty",
    successText: "Kiitos. Kaupungin pilottijärjestelmä vastaanotti havainnon.",
    reference: "Viite",
    errorTitle: "Lähetys epäonnistui",
    errorText: "Ilmoitusta ei lähetetty. Tarkista tiedot ja yritä uudelleen.",
    required: "Tämä kenttä on pakollinen.",
    invalidEmail: "Anna kelvollinen sähköpostiosoite.",
    locationRequired: "Lisää karttapiste tai katuosoite.",
    locationError: "Anna sekä leveys- että pituusaste tai käytä katuosoitetta.",
    natureOtherRequired: "Kuvaile havainto.",
    consentRequired: "Suostumus vaaditaan ennen lähetystä.",
    natureOptions: {
      melted_snow: "Sulanut lumi",
      warm_ground: "Poikkeuksellisen lämmin maanpinta",
      vapor: "Höyryä maasta, kaivosta tai tuuletusputkesta",
      water_pond: "Vesilammikko",
      ground_depression: "Maan painuma",
      other: "Jotain muuta"
    },
    classificationOptions: {
      slight_suspicion: "Lievä epäily",
      clear_deviation: "Selvä poikkeama",
      probable_leak: "Todennäköinen kaukolämpövuoto"
    },
    priorOptions: {
      yes: "Kyllä",
      no: "Ei",
      unsure: "En ole varma"
    }
  }
};
