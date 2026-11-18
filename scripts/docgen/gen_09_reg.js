/** 09 Registration/TIN & Founder ID — status letter, cover sheet, checklist. */
const C = require("./common.js");
const fs = require("fs");

const body = [
  C.h1("Company Registration and TIN — Status Statement"),
  C.para([
    C.run("To the programme review committee: "),
  ]),
  C.para("Adwa Sec is presented in this application as a founder-led venture currently operating through the Adwa Cyber Research Lab at Bahir Dar University. The company is not yet registered. This is a deliberate sequencing decision recorded in the venture's business plan: formation of a private limited company (PLC) at the Ethiopian Commercial Register in Addis Ababa is scheduled for the first quarter of 2027 as the first use of pre-seed funds, with the two founders — Solomon Asalif (Founder & CEO) and Zelalem Tsegaye (Co-founder & CTO) — as initial shareholders and a written intellectual-property ledger assigning all pre-incorporation work to the company at formation."),
  C.para("A Taxpayer Identification Number (TIN) will be obtained in the formation process, as required for a registered taxpayer in Ethiopia, and the company's certificate of incorporation and TIN certificate will be provided to the programme upon issuance. Any grant disbursement milestones that require a registered contracting entity will be scheduled after formation; the venture's roadmap already sequences payments accordingly."),
  C.para("Each founder's identification documents — passport or national identification card, and proof of address — are available for presentation wherever identification is requested by the programme, and will be supplied in the format and at the moment the programme specifies, for both Solomon Asalif and Zelalem Tsegaye. Both founders' contact and education details appear as clearly marked fill-in fields in the accompanying curriculum vitae (AdwaSec_01_Founder_CV.docx) so the venture can keep this package shareable while the founders complete the personal-data entries."),
  C.para("For verification of the venture's technical claims, none of this is required: the platform source code, its 766-check test battery and the live demonstration instructions are provided in this package (AdwaSec_08_MVP_Demonstration.docx)."),
  C.h1("Attachment Cover Sheet (for use once documents are issued)"),
  ...C.dataTable({
    headers: ["Item", "Value"],
    widths: [40, 60],
    caption: "To be completed and attached when registration is complete",
    rows: [
      ["Registered company name", "[to be completed at formation]"],
      ["Legal form", "Private Limited Company (PLC) — planned"],
      ["Date of registration", "[____/____/____]"],
      ["Registration number", "[to be completed]"],
      ["Taxpayer Identification Number (TIN)", "[to be completed]"],
      ["Registered address", "[to be completed — Addis Ababa]"],
      ["Issuing authority", "Ethiopian Commercial Register (as applicable)"],
    ],
  }),
  C.h1("Founder Identification Checklist"),
  ...C.dataTable({
    headers: ["Founder", "Document", "Status", "Notes"],
    widths: [22, 34, 14, 30],
    caption: "Items available for presentation on request, per founder",
    rows: [
      ["Solomon Asalif", "Passport or Ethiopian national ID card", "Available", "Presented in person or as certified copy where requested"],
      ["Solomon Asalif", "Proof of address", "Available", "Utility bill or equivalent"],
      ["Solomon Asalif", "Passport-size photographs", "Available", "Programme-specified quantity and format on request"],
      ["Solomon Asalif", "Founder curriculum vitae", "Attached", "AdwaSec_01_Founder_CV.docx (personal fill-in fields marked)"],
      ["Solomon Asalif", "University affiliation evidence", "On request", "Adwa Cyber Research Lab, Bahir Dar University"],
      ["Zelalem Tsegaye", "Passport or Ethiopian national ID card", "Available", "Presented in person or as certified copy where requested"],
      ["Zelalem Tsegaye", "Proof of address", "Available", "Utility bill or equivalent"],
      ["Zelalem Tsegaye", "Passport-size photographs", "Available", "Programme-specified quantity and format on request"],
      ["Zelalem Tsegaye", "Founder curriculum vitae", "Attached", "AdwaSec_01_Founder_CV.docx (personal fill-in fields marked)"],
    ],
  }),
  ...C.letterClose("Solomon Asalif & Zelalem Tsegaye", "Founders — Adwa Sec"),
  new (require("docx").Paragraph)({ children: [] }),
  C.para([C.run("Date: November 2026", { color: "506070" })], { after: 0 }),
];

const doc = C.makeDoc({
  cover: null,
  body,
  headerTitle: "Adwa Sec — Registration and Founder Identification",
});
C.docx.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.cwd() + "/download/AdwaSec_09_Registration_and_Founder_ID.docx", buf);
  console.log("written: AdwaSec_09_Registration_and_Founder_ID.docx");
});
