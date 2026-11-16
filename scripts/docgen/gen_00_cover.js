/** 00 Package cover letter + requirement-to-file checklist. */
const C = require("./common.js");
const fs = require("fs");
const N = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/docgen/numbers.json", "utf8"));

const body = [
  C.h1("Application Cover Letter"),
  C.para([
    C.run("To the startup incubation programme review committee,"), 
  ], { align: C.docx.AlignmentType.LEFT, after: 200 }),
  C.para("I am applying on behalf of Adwa Sec, a founder-led cybersecurity venture building the platform Ethiopia's regulated financial sector is now required to defend itself with. Adwa Sec automates compliance with the 47 obligations of the Personal Data Protection Proclamation No. 1321/2024 and the 30 obligations of NBE SBB/83/2022, delivers vulnerability assessment and penetration testing to the National Bank of Ethiopia's LOT4 tender specification, analyses Active Directory attack paths, operates a NIST-aligned SOC/CERT service, and delivers Amharic-first security awareness — all in one bilingual platform that already exists as a tested MVP with 766 automated checks green."),
  C.para("The venture seeks incubation support and an ETB " + (N.ask_etb / 1e6).toFixed(0) + " million pre-seed investment (approximately USD " + N.summary.ask_usd.toLocaleString("en-US") + " thousand) for eighteen months of runway: to register the company, formalise the Bahir Dar University technology-transfer agreement, convert named pilot interest into paid engagements, stand up the SOC service, and reach monthly run-rate break-even in late 2028 with a first profitable year in 2029. The enclosed documents evidence every claim: the platform is demonstrated live, the market problem is quantified from cited sources, and the plan's figures are traced to an accompanying financial model."),
  C.para("The checklist below maps each programme requirement to the file that answers it. Where personal data remains for me to complete (phone number, email, education and employment history in the curriculum vitae), the fields are clearly marked placeholders; everything else is final. I welcome any technical due diligence the committee wishes to run against the platform's source code, its test battery or its live demonstration."),
  ...C.letterClose("Solomon Asalif", "Founder — Adwa Sec"),
  C.para([C.run("Addis Ababa, Ethiopia — November 2026", { color: "506070" })], { after: 240 }),
  C.h1("Requirement Checklist and Package Map"),
  ...C.dataTable({
    headers: ["Programme requirement", "Enclosed file", "Status"],
    widths: [40, 40, 20],
    caption: "Every checklist item mapped to its deliverable (files are in the application folder)",
    rows: [
      ["Founder CV — demonstrate technical background (Essential)", "AdwaSec_01_Founder_CV.docx", "Complete (personal fields marked)"],
      ["Startup concept note — 2–3 pages (Essential)", "AdwaSec_02_Concept_Note.docx", "Complete"],
      ["Business plan (Essential)", "AdwaSec_03_Business_Plan.docx", "Complete"],
      ["Pitch deck — 8–12 slides (Essential)", "AdwaSec_04_Pitch_Deck.pptx", "Complete"],
      ["Problem and solution document (Essential)", "AdwaSec_05_Problem_and_Solution.docx", "Complete"],
      ["Product/service roadmap (Important)", "AdwaSec_06_Product_Roadmap.docx", "Complete"],
      ["Financial projections (Important)", "AdwaSec_07_Financial_Projections.xlsx", "Complete (live model)"],
      ["MVP/prototype demonstration (If available)", "AdwaSec_08_MVP_Demonstration.docx", "Complete — live system"],
      ["Company registration and TIN (If registered)", "AdwaSec_09_Registration_and_Founder_ID.docx", "Status letter — registration planned Q1 2027"],
      ["Founder identification (Where requested)", "AdwaSec_09_Registration_and_Founder_ID.docx", "Available on request"],
    ],
  }),
  C.h1("Fields for the Founder to Complete Before Submission"),
  C.para("The package is complete except for personal details that only I can supply. They are marked with clearly visible bracketed placeholders in the curriculum vitae and this folder's index: telephone number and email address (curriculum vitae header and this letter's contact block), education history (degrees, institutions, years), any previous employment entries, and any certifications to list. Every other field in every document — venture facts, platform capabilities, market statistics, financial figures — is final and internally consistent across the package."),
  C.para("The financial model (AdwaSec_07_Financial_Projections.xlsx) is a live workbook: its assumptions sheet exposes the planning exchange rate, pricing tiers and payroll plan as editable inputs, and all downstream tables recalculate. The documents quote the model's default outputs (ETB 4.02M, 19.26M and 44.64M revenue across 2027–2029; ETB 10M ask)."),
];

const doc = C.makeDoc({
  cover: null,
  body,
  headerTitle: "Adwa Sec — Startup Application Package",
});
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/AdwaSec_00_Application_Cover.docx", buf);
  console.log("written: AdwaSec_00_Application_Cover.docx");
});
