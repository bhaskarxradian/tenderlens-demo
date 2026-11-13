/* ===========================================================================
   TenderLens — "How to apply" guides, one per submission portal
   Each lead's `portal` key picks a guide. Step text can use placeholders that
   app.js fills from the lead:
     {id}       tender ID / bid number to search for
     {emd}      EMD amount, or "as stated in the tender document"
     {deadline} submission deadline with time
     {portal}   portal host name (from portalUrl)
   Guides are general for the portal; the tender document always overrides them.
   =========================================================================== */

/* ---------- Bid readiness ----------
   What a company needs in place before it can submit. app.js works out which
   items a tender needs from its `portal` and its eligibility text (CERT-In,
   ISO 27001, EMD exemption). leadDays is a rough typical lead time, used to warn
   when an item can't realistically be done before the deadline. */
const READINESS_ITEMS = [
  {key:"dsc",group:"Digital signature",label:"Class III DSC (signing + encryption)",why:"Signs and encrypts your bid on CPPP portals.",expiry:true,leadDays:3,leadText:"can take a few days to issue"},
  {key:"acct-cppp",group:"Portal accounts",label:"Bidder account on eprocure.gov.in",why:"Needed to submit central government tenders on CPPP.",leadDays:1,leadText:"about a day once you have a DSC"},
  {key:"acct-cpse",group:"Portal accounts",label:"Bidder account on etenders.gov.in",why:"Separate from eprocure.gov.in; needed for central PSU tenders such as DMRC.",leadDays:1,leadText:"about a day once you have a DSC"},
  {key:"acct-gem",group:"Portal accounts",label:"GeM seller account with a complete profile",why:"Needed to bid on GeM.",leadDays:7,leadText:"profile checks can take a week or more"},
  {key:"pan-gst",group:"Company documents",label:"Company PAN and GST certificate",why:"Asked for in almost every Indian tender.",leadDays:0,leadText:"you should already have these"},
  {key:"financials",group:"Company documents",label:"Audited accounts for the last 3 years",why:"Proves the turnover criterion.",leadDays:7,leadText:"needs your CA if not ready"},
  {key:"udyam",group:"Company documents",label:"Udyam (MSE) certificate",why:"Lets you skip the EMD where the tender allows an exemption.",leadDays:1,leadText:"free and online"},
  {key:"iso27001",group:"Certifications",label:"ISO/IEC 27001 certificate",why:"Asked for in many IT and security tenders.",expiry:true,leadDays:90,leadText:"certification usually takes months"},
  {key:"certin",group:"Certifications",label:"CERT-In empanelment",why:"Required for government security audits and VAPT.",expiry:true,leadDays:120,leadText:"empanelment usually takes months"},
  {key:"uk-cdp",group:"International",label:"UK Central Digital Platform registration",why:"Needed for UK tenders under the Procurement Act 2023.",leadDays:2,leadText:"a day or two"},
  {key:"espd",group:"International",label:"ESPD (European Single Procurement Document)",why:"Standard self-declaration for EU tenders; fill once and reuse.",leadDays:1,leadText:"about a day"},
  {key:"us-vendor",group:"International",label:"US agency vendor registration",why:"Needed to submit to US public agencies.",leadDays:5,leadText:"several days"},
];

const CPPP_STEPS = [
  {t:"Get a Class III Digital Signature Certificate (DSC)",
   d:"Buy one from a licensed certifying authority if you don't already have one. It must allow signing and encryption, and it can take a few days to issue, so start now. Every upload is signed and encrypted with it."},
  {t:"Enrol as a bidder on {portal}",
   d:"Choose Online Bidder Enrollment, enter your company details, then log in and register your DSC. Each government portal has its own account: an account on one doesn't work on another."},
  {t:"Find this tender",
   d:"Use the tender search and enter Tender ID {id}. Add it to your favourites so it's easy to find again."},
  {t:"Download and read the tender documents",
   d:"Download the notice inviting tender (NIT), scope of work and BOQ. Check eligibility, the pre-bid meeting date and any corrigenda listed under the tender; they can change dates and terms."},
  {t:"Arrange the EMD and tender fee",
   d:"EMD: {emd}. Pay it the way the NIT says: online on the portal, or a bank guarantee or demand draft whose original must reach the buyer by a set date. Upload proof with your bid."},
  {t:"Prepare your covers",
   d:"Save technical documents as PDFs, named as the NIT asks. Enter prices in the buyer's BOQ spreadsheet; don't rename it or change its format, or the upload can be rejected."},
  {t:"Submit online, a day early",
   d:"Log in with your DSC, open the tender, go to bid submission, upload each cover and submit before {deadline}. The portal closes exactly on time and slows down on the last day."},
  {t:"Save the acknowledgement and track the result",
   d:"Download the bid submission receipt. After the deadline, check the tender status page for technical and financial bid opening results."},
];
const CPPP_PREP = [
  "Class III DSC (signing + encryption) for the person who will bid",
  "Company PAN, GST registration and incorporation certificate",
  "What the tender asks for: audited turnover, completion certificates for similar work, certifications (e.g. ISO 27001, CERT-In empanelment)",
  "Udyam (MSE) or DPIIT startup certificate, if you'll claim an EMD exemption",
];

const PORTAL_GUIDES = {
  "cppp":{
    name:"CPPP eProcure",
    intro:"Central government tenders are submitted on the Central Public Procurement Portal. Bids are signed and encrypted with a digital signature, so set that up first.",
    prep:CPPP_PREP, steps:CPPP_STEPS,
    help:"The portal's home page has a Bidders Manual Kit with screenshots of each step.",
  },
  "cppp-cpse":{
    name:"CPPP for central PSUs (etenders.gov.in)",
    intro:"Central PSU tenders, such as DMRC's, are on etenders.gov.in. It works like eprocure.gov.in but is a separate portal, so it needs its own bidder enrolment.",
    prep:CPPP_PREP, steps:CPPP_STEPS,
    help:"The portal's home page has a Bidders Manual Kit with screenshots of each step.",
  },
  "gem":{
    name:"GeM (Government e-Marketplace)",
    intro:"GeM bids are submitted from a seller account on gem.gov.in. Registration is free, but profile checks take time, so register well before the deadline.",
    prep:[
      "Company PAN, GST and bank account details",
      "Mobile number and email of the authorised person (used for OTPs and eSign)",
      "Udyam (MSE) or DPIIT startup certificate, if you'll claim exemptions or purchase preference",
      "What the bid asks for: turnover, past work orders, certifications, OEM authorisation",
    ],
    steps:[
      {t:"Register as a seller",d:"On gem.gov.in, sign up as a seller with your company PAN and the authorised person's details, then complete the seller profile (business, tax, bank and office details)."},
      {t:"Find this bid",d:"On bidplus.gem.gov.in, search for bid number {id}. Download the bid document, any additional terms (ATC) and corrigenda."},
      {t:"Check you qualify",d:"Read the eligibility in the bid document: turnover, experience, OEM authorisation and any MSE or startup relaxation. Note the pre-bid date and whether there's a reverse auction."},
      {t:"Arrange the EMD",d:"EMD: {emd}. Submit it as the bid specifies, or upload your exemption certificate if exemption is allowed."},
      {t:"Participate and upload",d:"From your seller dashboard, open the bid and choose to participate. Upload your documents, enter technical and price details, and sign with eSign or DSC when prompted."},
      {t:"Submit before the deadline",d:"Complete final submission before {deadline} and save the confirmation. Then watch the bid page for technical evaluation, any reverse auction and the result."},
    ],
    help:"GeM's seller help pages and training videos cover registration and bid participation.",
  },
  "buyer":{
    name:"The buyer's own website or portal",
    intro:"This buyer publishes tenders on its own site, so the exact process is in its tender document. These steps cover what usually applies.",
    prep:[
      "The RFP and every corrigendum or extension notice",
      "Company PAN, GST and incorporation documents",
      "DSC, if the RFP requires online submission",
    ],
    steps:[
      {t:"Download the RFP and all notices",d:"Get the RFP plus every corrigendum and extension notice from the buyer's tender page. Extensions often change the deadline."},
      {t:"Find out how bids are submitted",d:"The RFP says whether bids go through the bank's e-procurement portal, GeM, or by hand. If it's a portal, register as a vendor there first."},
      {t:"Send pre-bid questions",d:"Use the query format and email address in the RFP, before its query deadline."},
      {t:"Arrange the EMD",d:"EMD: {emd}. Use the method the RFP sets (usually online transfer or bank guarantee)."},
      {t:"Submit and keep proof",d:"Submit before {deadline} and keep the acknowledgement."},
    ],
  },
  "uk":{
    name:"UK e-sourcing portal",
    intro:"UK notices point to the buyer's e-sourcing portal, where documents, clarifications and submission all happen.",
    prep:[
      "Your organisation's registration on the UK Central Digital Platform (needed for tenders under the Procurement Act 2023)",
      "Company details, insurance certificates and recent accounts",
      "Case studies and references the tender asks for",
    ],
    steps:[
      {t:"Register on the Central Digital Platform",d:"For Procurement Act 2023 tenders, register your organisation on Find a Tender and get a share code to give the buyer."},
      {t:"Register on the buyer's portal",d:"Create a free supplier account on {portal}."},
      {t:"Express interest",d:"Open this opportunity on the portal and express interest to unlock the documents and clarification messages."},
      {t:"Ask clarifications",d:"Send questions through the portal's messaging before the clarification deadline. Answers are shared with all bidders."},
      {t:"Complete and submit",d:"Answer the qualification and award questions, upload attachments and submit before {deadline}. Keep the submission confirmation email."},
    ],
  },
  "eu":{
    name:"EU tender via a national portal",
    intro:"TED publishes the notice; the documents and submission are on the buyer's national portal linked from it.",
    prep:[
      "European Single Procurement Document (ESPD) for your company",
      "Company registration, financial statements and insurance",
      "Case studies that match the selection criteria",
    ],
    steps:[
      {t:"Open the national portal from the TED notice",d:"Follow the link in the notice to {portal} and register as a supplier."},
      {t:"Check the procedure",d:"In a restricted procedure you first submit a request to participate (qualification). Only shortlisted companies are invited to send a full tender."},
      {t:"Ask clarifications",d:"Use the portal's messaging before the clarification deadline."},
      {t:"Submit before the deadline",d:"Upload the ESPD and your response before {deadline} and keep the receipt."},
    ],
  },
  "us":{
    name:"US public buyer",
    intro:"Federal opportunities need an active SAM.gov registration. State and local agencies, like this one, use their own vendor registration and portal.",
    prep:[
      "Unique Entity ID (UEI) and active SAM.gov registration, for federal work",
      "The agency's vendor registration",
      "Past-performance references and required certifications",
    ],
    steps:[
      {t:"Register as a vendor",d:"Create a vendor account on {portal}. For federal work, also register your entity on SAM.gov, which can take several weeks."},
      {t:"Download the RFP and addenda",d:"Addenda change scope and dates; acknowledge each one as the RFP requires."},
      {t:"Send written questions",d:"Submit questions by the RFP's question deadline and attend the pre-proposal meeting if there is one."},
      {t:"Submit before the deadline",d:"Upload your proposal and pricing before {deadline} and keep the confirmation."},
    ],
  },
};
