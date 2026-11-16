/** 00 Package cover letter + requirement-to-file checklist. */
const C = require("./common.js");
const fs = require("fs");
const N = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/docgen/numbers.json", "utf8"));

const body = [
  C.h1("Application Cover Letter"),
  C.para([
    C.run("To the startup incubation programme review committee,"), 
  ], { align: C.docx.AlignmentType.LEFT, after: 200 }),
  C.para("We are applying on behalf of Adwa Sec, a founder-led cybersecurity venture building the platform Ethiopia's regulated financial sector is now required to defend itself with. Adwa Sec automates compliance with the 47 obligations of the Personal Data Protection Proclamation No. 1321/2024 and the 30 obligations of NBE SBB/83/2022, delivers vulnerability assessment and penetration testing to the National Bank of Ethiopia's LOT4 tender specification, analyses Active Directory attack paths, operates a NIST-aligned SOC/CERT service, and delivers Amharic-first security awareness — all in one bilingual platform that already exists as a tested MVP with 766 automated checks green. We are two founders: Solomon Asalif (Founder & CEO — strategy, regulation, compliance engines, tenders and sales) and Zelalem Tsegaye (Co-founder & CTO — platform engineering, VAPT engine, attack-path analysis and security operations)."),
  C.para("The venture seeks incubation support and an ETB " + (N.ask_etb / 1e6).toFixed(0) + " million pre-seed investment (approximately USD " + Math.round(N.summary.ask_usd / 1000) + " thousand at the National Bank of Ethiopia's indicative rate of ETB " + N.fx_etb_per_usd.toFixed(2) + " per USD, 12 November 2026) for eighteen months of runway: to register the company, formalise the Bahir Dar University technology-transfer agreement, convert named pilot interest into paid engagements, stand up the SOC service, and reach monthly run-rate break-even in late 2028 with a first profitable year in 2029. The enclosed documents evidence every claim: the platform is demonstrated live, the market problem is quantified from cited sources, and the plan's figures are not estimates — every input is anchored to current, cited data (NBE exchange rate and institution counts, IMARC market sizing, levels.fyi salary benchmarks, current global service-price benchmarks) and every downstream number is computed from those inputs in the accompanying financial model, which shows its basis of preparation on a dedicated sheet."),
  C.para("The checklist below maps each programme requirement to the file that answers it. Where personal data remains for us to complete (telephone and email for both founders, plus education and employment history in the curriculum vitae), the fields are clearly marked placeholders; everything else is final. We welcome any technical due diligence the committee wishes to run against the platform's source code, its test battery or its live demonstration."),
  ...C.letterClose("Solomon Asalif & Zelalem Tsegaye", "Founders — Adwa Sec"),
  C.para([C.run("Addis Ababa, Ethiopia — November 2026", { color: "506070" })], { after: 240 }),
  C.h1("Requirement Checklist and Package Map"),
  ...C.dataTable({
    headers: ["Programme requirement", "Enclosed file", "Status"],
    widths: [40, 40, 20],
    caption: "Every checklist item mapped to its deliverable (files are in the application folder)",
    rows: [
      ["Founder CVs — demonstrate technical background (Essential)", "AdwaSec_01_Founder_CV.docx", "Complete — CVs for both founders (personal fields marked)"],
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
  C.h1("Fields for the Founders to Complete Before Submission"),
  C.para("The package is complete except for personal details that only we can supply. They are marked with clearly visible bracketed placeholders in the curriculum vitae and this folder's index: telephone number and email address for both founders (curriculum vitae headers and this letter's contact block), education history for each founder (degrees, institutions, years), any previous employment entries, and any certifications to list. Every other field in every document — venture facts, platform capabilities, market statistics, financial figures — is final and internally consistent across the package."),
  C.para("The financial model (AdwaSec_07_Financial_Projections.xlsx) is a live workbook: its assumptions sheet exposes the planning exchange rate (ETB " + N.fx_etb_per_usd.toFixed(2) + " per USD — the National Bank of Ethiopia's indicative rate of 12 November 2026), pricing tiers and the two-founder payroll plan as editable inputs, a dedicated Basis & Sources sheet documents where every number comes from, and all downstream tables recalculate. The documents quote the model's computed outputs (ETB " + (N.summary.revenue[0] / 1e6).toFixed(2) + "M, " + (N.summary.revenue[1] / 1e6).toFixed(2) + "M and " + (N.summary.revenue[2] / 1e6).toFixed(2) + "M revenue across 2027–2029; ETB 10M ask)."),
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
