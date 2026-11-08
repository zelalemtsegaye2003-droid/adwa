/**
 * Adwa Cyber — Awareness Platform curriculum corpus (proposal Phase 3, Track B).
 *
 * The Amharic-first cyber-safety curriculum developed in the first half of
 * Year 1 (proposal §3.2 Track B): eight bilingual units for grades 7–10,
 * each with a short lesson and a four-item quiz bank. Quiz items double as
 * the RQ2 pre/post knowledge-instrument pool (see seed-awareness.cjs, which
 * draws the fixed 16-item instrument from this bank).
 *
 * Language policy: the learner portal is Amharic-first with an English
 * toggle; both languages carry the full content (no shortened translation).
 */

export interface QuestionSeed {
  promptEn: string;
  promptAm: string;
  optionsEn: string[];
  optionsAm: string[];
  answerIdx: number;
  explainEn: string;
  explainAm: string;
}

import type { Audience } from "./awareness-tools";

export interface ModuleSeed {
  code: string;
  sortOrder: number;
  topic: string;
  titleEn: string;
  titleAm: string;
  summaryEn: string;
  summaryAm: string;
  durationMin: number;
  gradeBand: string;
  audience: Audience;
  contentEn: string;
  contentAm: string;
  questions: QuestionSeed[];
}

export const AWARENESS_TOPICS = [
  "passwords",
  "phishing",
  "social_media",
  "cyberbullying",
  "personal_data",
  "safe_browsing",
  "device_security",
  "reporting",
] as const;

export const AWARENESS_MODULES: ModuleSeed[] = [
  {
    code: "AW-01",
    sortOrder: 1,
    topic: "passwords",
    titleEn: "Strong Passwords and Accounts",
    titleAm: "ጠንካራ የይለፍ ቃሎችና መለያዎች",
    summaryEn: "How to build passwords that resist guessing, why re-use is dangerous, and what a second lock (2FA) adds.",
    summaryAm: "ገምታ የማይችሉ የይለፍ ቃሎችን እንዴት መሥራት እንደሚቻል፣ ቃልን መድገም ለምን አደገኛ መሆኑንና ሁለተኛ ቁልፍ (2FA) ምን ጠቀሜታ እንዳለው።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## Why passwords matter
A password is the key to your digital home. If someone takes it, they can read your messages, spend your family's money, or pretend to be you.

## Make it long, make it strange
Use at least 12 characters. The best passwords are passphrases: four unrelated words plus a number and a symbol, like Blue-Donkey-7-Coffee!. Length beats cleverness — every extra character multiplies the work an attacker must do.

## Never re-use a key
If you use one password everywhere, one leaked website unlocks your e-mail, your games and your school account. Keep a different password for each important account.

## The second lock: two-factor authentication
Two-factor authentication (2FA) asks for a code from your phone after the password. Even if your password leaks, a thief still cannot enter. Turn it on wherever it is offered.

## If you think a password was stolen
Change it immediately and tell a trusted adult. Never keep a secret about a broken lock.`,
    contentAm: `## የይለፍ ቃል ለምን አስፈላጊ ነው?
የይለፍ ቃል የዲጂታል ቤታችሁ ቁልፍ ነው። ማንም ቃሉን ከወሰደ መልዕክቶቻችሁን ማንበብ፣ የቤተሰብ ገንዘብ ማዋል ወይም በስምላችሁ ማስመሰያት ይችላል።

## ረጅም እና ያልተለመደ ይሁን
ቢያንስ 12 ፊደላት ይጠቀሙ። ምርጥ የይለፍ ቃሎች ሐረጎች ናቸው፦ አራት የተለያዩ ቃላትና ቁጥርና ምልክት አክል፣ ለምሳሌ Blue-Donkey-7-Coffee!። ርዝመት ብልህነትን ይበልጣል — እያንዳንዱ ተጨማሪ ፊደል የጠላቹን ሥራ ይባዛል።

## ቁልፍን በሁሉም በር አትጠቀም
አንድ የይለፍ ቃል በየቦታው ከተጠቀሙ፣ አንድ ድረ-ገጽ ከፈሰሰ ኢሜይላችሁን፣ ጨዋታዎቻችሁንና የትምህርት ቤት መለያችሁን ይከፍታል። ለእያንዳንዱ አስፈላጊ መለያ የተለየ የይለፍ ቃል ይያዙ።

## ሁለተኛው ቁልፍ፦ ሁለት-ደረጃ ማረጋገጫ
ሁለት-ደረጃ ማረጋገጫ (2FA) ከይለፍ ቃሉ በኋላ ከስልካችሁ ኮድ ይጠይቃል። ይለፍ ቃላችሁ ቢፈስም ሌባ መግባት አይችልም። በሚቀርብበት ሁሉ አንቁት።

## የይለፍ ቃል መሰረቅ ብትሆን
ወዲያውኑ ቀይሩትና ለሚያምኑበት አዋቂ ንገሩ። በተበላሸ ቁልፍ ላይ ምስጢር አትይዙ።`,
    questions: [
      {
        promptEn: "Which password is the strongest?",
        promptAm: "በጣም ጠንካራው የይለፍ ቃል የትኛው ነው?",
        optionsEn: ["123456789", "Blue-Donkey-7-Coffee!", "selam1998", "password1"],
        optionsAm: ["123456789", "Blue-Donkey-7-Coffee!", "ሰላም1998", "password1"],
        answerIdx: 1,
        explainEn: "Length plus a mix of words, a number and a symbol makes guessing enormously harder.",
        explainAm: "ርዝመት፣ የተለያዩ ቃላት፣ ቁጥርና ምልክት መገመትን እጅግ ያስቸግራል።",
      },
      {
        promptEn: "Why should you NOT use the same password on every website?",
        promptAm: "በየድረ-ገጹ ተመሳሳይ የይለፍ ቃል ለምን መጠቀም የለምም?",
        optionsEn: [
          "It is hard to remember",
          "One leaked website would unlock all your accounts",
          "Websites do not allow it",
          "It makes the internet slower",
        ],
        optionsAm: [
          "ማስታወሱ አዳጋች ስለሆነ",
          "አንድ ድረ-ገጽ ከፈሰሰ ሁሉንም መለያዎች ይከፍታል",
          "ድረ-ገጾች አይፈቅዱም",
          "ኢንተርኔቱን ያዘጋዋል",
        ],
        answerIdx: 1,
        explainEn: "Credential stuffing tools try a leaked password everywhere — one leak becomes every leak.",
        explainAm: "የፈሰሱ የይለፍ ቃላት በየገጹ ይሞከራሉ — አንድ ፍሰት ሁሉንም ፍሰት ያደርገዋል።",
      },
      {
        promptEn: "What does two-factor authentication (2FA) add to your account?",
        promptAm: "ሁለት-ደረጃ ማረጋገጫ (2FA) ለመለያዎ ምን ይጨምራል?",
        optionsEn: [
          "A second password you must type twice",
          "A code from your phone required after the password",
          "A faster login",
          "A bigger storage space",
        ],
        optionsAm: [
          "ሁለት ጊዜ የሚታየው ሁለተኛ የይለፍ ቃል",
          "ከይለፍ ቃሉ በኋላ ከስልክ የሚጠየቅ ኮድ",
          "ፈጣን መግቢያ",
          "ትልቅ የመከማቻ ቦታ",
        ],
        answerIdx: 1,
        explainEn: "2FA proves it is you with something you have (the phone), not only something you know.",
        explainAm: "2FA የሚያረጋግጠው የሚያውቁትን ብቻ ሳይሆን ያላችሁትን (ስልክ) ነው።",
      },
      {
        promptEn: "You think someone learned your password. What is the FIRST thing to do?",
        promptAm: "ማንም የይለፍ ቃላችሁን እንደተማራ ካሰበሁ በመጀመሪያ ምን ማድረግ አለብኝ?",
        optionsEn: [
          "Wait a week to see if something happens",
          "Tell your friends online",
          "Change it immediately and tell a trusted adult",
          "Delete the account",
        ],
        optionsAm: [
          "የሚከሰት ነገር ለማየት ሳምንት መጠበቅ",
          "ለጓደኞች በኦንላይን መንገር",
          "ወዲያውኑ መቀየርና ለሚያምኑበት አዋቂ መንገር",
          "መለያውን መሰረዝ",
        ],
        answerIdx: 2,
        explainEn: "A stolen key loses its power the moment you change the lock — and an adult can help watch for harm.",
        explainAm: "የተሰረቀ ቁልፍ ብርቱን የሚያጣው ቁልፉን ሲቀይሩ ነው — አዋቂም ለጥፋት ያስተውላል።",
      },
    ],
  },
  {
    code: "AW-02",
    sortOrder: 2,
    topic: "phishing",
    titleEn: "Phishing and Scam Messages",
    titleAm: "የማታለል መልዕክቶችና ማጭበርበር",
    summaryEn: "Spotting fake messages that imitate banks, telecoms and teachers, and what to do instead of clicking.",
    summaryAm: "ባንኮችን፣ ቴሌኮሙኒኬሽንንና መምህራንን የሚስቡ የውሸት መልዕክቶችን ማወቅና ከመጫን ይልቅ የሚደረገው ነገር።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## What phishing is
Phishing is a message that pretends to come from someone you trust — your bank, Ethio Telecom, your school — to make you click a link, type a code, or send money. In Ethiopia it arrives by SMS, e-mail, Telegram and WhatsApp.

## The four warning signs
1. Urgency: "Your account will be blocked in 24 hours!"
2. A link that looks almost right: cbe-secure-verify.com instead of cbe.com.et.
3. A request for secrets: passwords, OTP codes, PIN numbers. No real bank ever asks.
4. A prize or a threat you never expected.

## Check before you click
Do not tap links in surprising messages. Open the official app or type the known address yourself. Ask: did I expect this message? Is the sender's address exactly right?

## What to do
Report the message (forward it to your bank's official number or to Ethio-CERT), then delete it. Never forward it "just to warn friends" without labelling it as a scam — that spreads the trap.`,
    contentAm: `## ማታለል (ፊሺንግ) ምንድን ነው?
ፊሺንግ ከሚያምኑት ሰው — ከባንካችሁ፣ ከኢትዮ ቴሌኮም፣ ከትምህርት ቤታችሁ — ተደርቆ የሚመጣ መልዕክት ነው፤ አገናኝ እንድታንኩ፣ ኮድ እንድተክሉ ወይም ገንዘብ እንድላኩ ለማድረግ። በኢትዮጵያ በኤስኤምኤስ፣ በኢሜይል፣ በቴሌግራምና በዋትስአፕ ይመጣል።

## አራቱ የማስጠንቀቂያ ምልክቶች
1. አስቸኳይነት፦ “መለያዎ በ24 ሰዓት ውስጥ ይታጠፋል!”
2. የሚመስል ነገር የሚል አገናኝ፦ cbe.com.et ፈንታ cbe-secure-verify.com።
3. ምስጢር መጠየቅ፦ የይለፍ ቃል፣ የOTP ኮድ፣ ፒን። እውነተኛ ባንክ በጭራሽ አይጠይቅም።
4. ያልጠበቃችሁ ሽልማት ወይም ዛቻ።

## ከመጫናችሁ በፊት ያረጋግጡ
አጋጣሚ መልዕክቶችን አታንኩ። ይፋዊውን መተግበሪያ ክፈቱት ወይም የታወቀውን አድራሻ ራሳችሁ ጻፉ። ጠይቁት፦ ይህ መልዕክት አጠበቅሁት? የላኪው አድራሻ በትክክል የዚያው ነው?

## ምን ማድረግ
መልዕክቱን ዘግቡት (ለባንኩ ይፋዊ ቁጥር ወይም ለኢትዮ-ሴርት ይላኩት)፣ ከዚያ አጥፉት። “ጓደኞቼን ለማስጠን” ብላችሁ ያለ ማስታወሻ አትላኩት — ወጥመዱን ያሰራጫል።`,
    questions: [
      {
        promptEn: "An SMS says: 'Your CBE account is blocked! Verify now: cbe-secure-verify.com'. What is this?",
        promptAm: "ኤስኤምኤስ መጣ፦ “የሲቢኢ መለያዎ ታግዷል! አሁኑኑ ያረጋግጡ፦ cbe-secure-verify.com”። ይህ ምንድን ነው?",
        optionsEn: [
          "A real bank notice — click fast",
          "A phishing message imitating the bank",
          "A system error",
          "An advertisement",
        ],
        optionsAm: [
          "እውነተኛ የባንክ ማስታወሻ — በፍጥነት መጫን",
          "ባንኩን የሚስብ የማታለል መልዕክት",
          "የሥርዓት ስህተት",
          "ማስታወቂያ",
        ],
        answerIdx: 1,
        explainEn: "Urgency plus a look-alike domain is the classic phishing pair. Real banks never block accounts by link.",
        explainAm: "አስቸኳይነትና የሚመስል ዌብሳይት የፊሺንግ ባህርይ ናቸው። እውነተኛ ባንክ በአገናኝ መለያ አያጠፋም።",
      },
      {
        promptEn: "Which of these will a real bank NEVER ask you for in a message?",
        promptAm: "እውነተኛ ባንክ በመልዕክት በጭራሽ የማይጠይቃችሁ የትኛው ነው?",
        optionsEn: ["Your opinion", "Your OTP code or password", "Your full name", "Your branch city"],
        optionsAm: ["አመለካከታችሁን", "የOTP ኮዳችሁን ወይም የይለፍ ቃላችሁን", "ሙሉ ስማችሁን", "የቅርንጫፍ ከተማችሁን"],
        answerIdx: 1,
        explainEn: "One-time codes and passwords are secrets; no legitimate institution requests them by message.",
        explainAm: "አንድ ጊዜ የሚያልፉ ኮዶችና የይለፍ ቃላት ምስጢር ናቸው፤ ሕጋዊ ተቋም በመልዕክት አይጠይቃቸውም።",
      },
      {
        promptEn: "You receive a suspicious message. What is the best action?",
        promptAm: "ጥርጣሬ ያለው መልዕክት መጣ። ምርጡ እርምጃ የትኛው ነው?",
        optionsEn: [
          "Click the link to check if it is real",
          "Reply asking the sender if they are honest",
          "Report it to the official number or Ethio-CERT, then delete it",
          "Forward it to all your friends",
        ],
        optionsAm: [
          "እውነተኛ መሆኑን ለማየት አገናኙን መጫን",
          "ላኪው እውነተኛ መሆኑን ጠይቆ መመለስ",
          "ለይፋዊው ቁጥር ወይም ለኢትዮ-ሴርት ዘግቦ ማጥፋት",
          "ለሁሉም ጓደኞች ማስተላለፍ",
        ],
        answerIdx: 2,
        explainEn: "Reporting through the official channel helps protect others; the link itself is the trap.",
        explainAm: "በይፋዊ ጣቢያ ማመልከት ሌሎችን ይጠብቃል፤ አገናኙ ራሱ ወጥመድ ነው።",
      },
      {
        promptEn: "Which pairing is a classic phishing trick?",
        promptAm: "የትኞቹ ጥምረት የፊሺንግ ዘዴ ነው?",
        optionsEn: [
          "Slow reply and bad grammar",
          "Urgent threat and a look-alike link",
          "Long text and small font",
          "A photo and a caption",
        ],
        optionsAm: [
          "ዝግታ መልስና የተበላሸ ፊደል",
          "የሚያስፈራ ዛቻና የሚመስል አገናኝ",
          "ረጅም ጽሑፍና ትንሽ ፊደል",
          "ፎቶና መግለጫ",
        ],
        answerIdx: 1,
        explainEn: "Fear rushes you past careful checking, and the fake domain harvests what you type.",
        explainAm: "ፍርሃት የማጣራት አቅምን ያልፋል፤ ውሸተኛው አድራሻም የጻፋችሁን ይሰበስባል።",
      },
    ],
  },
  {
    code: "AW-03",
    sortOrder: 3,
    topic: "social_media",
    titleEn: "Social Media Safety",
    titleAm: "የማህበራዊ ሚዲያ ደህንነት",
    summaryEn: "Sharing less, strangers, fake profiles, permanent posts, and keeping accounts private.",
    summaryAm: "ያልተጋራ መጋራት፣ አልበጃጅም ሰዎች፣ ውሸታማ መገለጫዎች፣ ዘላቂ ልጥፎችና መለያዎን የግል ማድረግ።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## The internet never forgets
A photo, a joke or an angry comment can be screenshotted the second it is posted. Before you post, ask: would I show this to my grandmother, my teacher, a future employer? If not, do not post it.

## Strangers with friendly faces
Not every profile is a real person. Fake profiles use stolen photos to build trust fast. Signs: very few posts, recent account, too interested in your personal life, quick requests for photos or money.

## Lock your accounts
Set your profile to private so only accepted friends see your posts. Check your follower list from time to time and remove accounts you do not actually know.

## Location is a secret
Photos can carry time and place. Posting "we are away" or a school uniform with a location tells strangers where to find you. Share trips after you return, not before.

## Kindness scales
What feels like a small joke to you can be huge to someone else. On the internet, kindness is a safety skill, not just politeness.`,
    contentAm: `## ኢንተርኔት አይረሳም
ፎቶ፣ ቀልድ ወይም ቁጭተኛ አስተያየት ሲለጥፍ በዚያው ሰከንድ ሊቀረጽ ይችላል። ከመልጠፋችሁ በፊት ጠይቁ፦ ይህን ለአያቬ፣ ለመምህሬ፣ ለወደፊት ሠራተኛ አሳያለሁ? ካልሆነ አትለጥፉ።

## በውሸት ፈገግ የሚሉ እንግዳዎች
እያንዳንዱ መገለጫ እውነተኛ ሰው አይደለም። ውሸታማ መገለጫዎች የተሰረቁ ፎቶዎችን ይጠቀማሉ። ምልክቶች፦ ጥቂት ልጥፎች፣ የአዲስ መለያ፣ በግል ሕይወታችሁ ላይ ያለ ጊዜ ጉዳይ፣ በፍጥነት ፎቶ ወይም ገንዘብ መጠየቅ።

## መለያዎን ቁልፉ
መገለጫችሁን የግል አድርጉት በይፋ የሚያዩት የተቀበላችሁ ጓደኞች ብቻ ይሁኑ። ከጊዜ ወደ ጊዜ የከታተያችሁን ዝርዝር ይመልከቱና የማታውቁትን አስወግዱ።

## አካባቢ ምስጢር ነው
ፎቶዎች ጊዜና ቦታ ይይዛሉ። “ተጓዘን” ወይም አካባቢያዊ ምልክት ያለው የትምህርት ቤት ልብስ ማሳየት እንግዳዎችን ወደናንተ ያመራል። ጉዞን ከተመለሳችሁ በኋላ ያካፍሉ አስቀድሞ አይደለም።

## ትህትነት ይሰራል
ለናንተ ትንሽ ቀልድ ለሚመስለው ሌላው ሰው ትልቅ ሊሆን ይችላል። በኢንተርኔት ትህትነት የስነ ምግባር ብቻ ሳይሆን የደህንነት ክህሎት ነው።`,
    questions: [
      {
        promptEn: "A new follower with no posts asks where you live and studies your daily routine. What is the safe reaction?",
        promptAm: "ያለ ልጥፍ ያለው አዲስ ከታተያ የት እንደሚኖሩና ዕለታዊ ሥራችሁን ጠይቃል። ደህንነታዊ ምላሹ የትኛው ነው?",
        optionsEn: [
          "Answer politely — being friendly is important",
          "Share only the sub-city, not the house",
          "Do not share personal details; remove/block and tell an adult",
          "Ask them to send their photo first",
        ],
        optionsAm: [
          "በልጋጋነት መመለስ — ወዳጅነት አስፈላጊ ነው",
          "ቤቱን ሳይሆን ክፍለ ከተማውን ብቻ መንገር",
          "የግል ዝርዝር አትንገሩ፤ አስወግዱ/ከልክሉ እና ለአዋቂ ንገሩ",
          "መጀመሪያ ፎቶዋቸውን መጠየቅ",
        ],
        answerIdx: 2,
        explainEn: "Strangers mapping your routine is a grooming pattern — cut the information flow and involve an adult.",
        explainAm: "እንግዳ ሥራችሁን መቅዳት የማሳመን ስርዓት ነው — መረጃውን ዝግ አድርጉት አዋቂን ያሳውቁ።",
      },
      {
        promptEn: "Why should social accounts be set to private?",
        promptAm: "የማህበራዊ ሚዲያ መለያዎች ለምን የግል መሆን አለባቸው?",
        optionsEn: [
          "To get more followers",
          "So only accepted friends can see your posts",
          "Because the app requires it",
          "To hide them from family",
        ],
        optionsAm: [
          "ተከታዮችን ለማበዛት",
          "ልጥፋችሁን የሚያዩት የተቀበላችሁ ጓደኞች ብቻ እንዲሆኑ",
          "መተግበሪያው ስለሚጠይቅ",
          "ከቤተሰብ ለመሰወር",
        ],
        answerIdx: 1,
        explainEn: "Privacy settings are the fence around your digital home; strangers must knock first.",
        explainAm: "የግል ማስተካከያዎች የዲጂታል ቤታችሁ አጥር ናቸው፤ እንግዳ መድረስ አለበት።",
      },
      {
        promptEn: "A classmate posts an embarrassing photo of you. The best first step is to:",
        promptAm: "ተማሪ ወዳጃችሁ ያሳፈረ ፎቶዋችሁን ለጠፋ። ምርጡ የመጀመሪያ እርምጃ፦",
        optionsEn: [
          "Post an embarrassing photo back",
          "Ask them calmly to remove it, and tell an adult if it stays",
          "Tell everyone to report their account",
          "Ignore it forever",
        ],
        optionsAm: [
          "ያሳፈረ ፎቶ በመመለስ መልሶ ማስቀመጥ",
          "በሰላም እንዲያስወግድት መጠየቅ፣ ካልተደረገ ለአዋቂ መንገር",
          "ሁሉም መለያውን እንዲዘግዝ መንገር",
          "ለእኛም ለዘላለም መተው",
        ],
        answerIdx: 1,
        explainEn: "Escalating online creates more harm; a direct request plus an adult solves it fastest.",
        explainAm: "በኦንላይን መበደር ተጨማሪ ጉዳት ይፈጥራል፤ ቀጥተኛ ጥያቄና አዋቂ ፈጣን መፍትሔ ነው።",
      },
      {
        promptEn: "Which post is safest to share?",
        promptAm: "ለመጋራት የተሻለው ልጥፍ የትኛው ነው?",
        optionsEn: [
          "Live location on the way to a trip",
          "A photo of your ID card",
          "A landscape photo shared after returning home",
          "Your class schedule with room numbers",
        ],
        optionsAm: [
          "ወደ ጉዞ ስንመጣ የቀጥታ አካባቢ ማሳያ",
          "የመታወቂያ ካርዳችሁ ፎቶ",
          "ከተመለሳችሁ በኋላ የተጋራ የመስክ ፎቶ",
          "የክፍል ቀጠሮአችሁ ከክፍል ቁጥር ጋር",
        ],
        answerIdx: 2,
        explainEn: "Sharing the past is safe; sharing live location, IDs or routines tells strangers where you are.",
        explainAm: "ያለፈውን መጋራት ደህንነቱ ነው፤ የቀጥታ አካባቢ፣ መታወቂያ ወይም ሥራ ማጋራት እንግዳን ያመራል።",
      },
    ],
  },
  {
    code: "AW-04",
    sortOrder: 4,
    topic: "cyberbullying",
    titleEn: "Cyberbullying — recognise, refuse, report",
    titleAm: "በኢንተርኔት ማስጨነቅ — ይሁን፣ አትቀበል፣ ዘግር",
    summaryEn: "What counts as cyberbullying, how to respond without escalating, and where to get help.",
    summaryAm: "ማስጨነቅ ምን መባል እንዳለበት፣ ያለ መበደር እንዴት መመለስ እንደሚቻልና ከየት እርዳታ እንደሚገኝ።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## It is not "just a joke"
Cyberbullying is repeated harm through messages, posts, groups or exclusion — insults, spreading rumours, sharing private photos, creating fake accounts in someone's name. If it hurts and keeps happening, it is bullying, whatever the sender calls it.

## You are not alone
Being targeted says something about the bully, not about you. Many students face this; the ones who recover fastest are the ones who tell someone early.

## The three R's
1. Recognise — name it: this is bullying, not friendship teasing.
2. Refuse to play — do not reply with insults. Replying is the oxygen bullying needs.
3. Report — block the account, keep screenshots as evidence (photo of the screen with the date), and tell a teacher, parent or school counsellor. In serious cases, reports can also go to the police cybercrime desk and Ethio-CERT.

## If you see it happen
Do not like, share or stay silent. Send a private message to the target: "This is wrong, are you okay?" Supporting the target breaks the bully's power. Screenshot and report.

## If you were the bully
It takes courage to admit. Apologise, delete the posts, and talk to an adult. Everyone deserves a way back.`,
    contentAm: `## “ቀልድ ብቻ” አይደለም
የኢንተርኔት ማስጨነቅ በመልዕክት፣ በልጥፍ፣ በግሩፕ ወይም በመገለል የሚፈጸም ተደጋጋሚ ጉዳት ነው — ማሰደብ፣ የውርደት ዜና ማሰራጨት፣ የግል ፎቶ ማሳየት፣ በሰው ስም ውሸታማ መለያ መፍጠር። ያሳማቸውና ቀጥሎ ከሚከሰት ማስጨነቅ ነው፣ ላኪው ምን ብሎ ሰይሞት።

## ብቻችሁ አይደላችሁም
ዒላማ መሆናችሁ ስለ ጨካዩ ሰው ነው ስለ ናንተ አይደለም። ብዙ ተማሪዎች ይገጥማቸዋል፤ በፍጥነት የሚያገገሙት በጊዜ ለማንም የነገሩ ናቸው።

## ሦስቱ ምልክቶች
1. ለይ — ስሙት፦ ይህ ማስጨነቅ ነው የጓደኝነት ቀልድ አይደለም።
2. አትተካ — በማሰደብ አትመልሱ። መልስ ማስጨነቁ ኦክስጅን ነው።
3. ዘግር — መለያውን ከልክሉ፣ ማስረጃ ሆኖ ስክሪንሾት ያዙ (ቀኑ የታየበት)፣ ለመምህር፣ ለወላጅ ወይም ለቤት ቤት አማካሪ ንገሩ። ከባድ ሁኔታዎች ለፖሊስ የሳይበር ወንጀል ክፍልና ለኢትዮ-ሴርትም ማመልከት ይቻላል።

## ከተከናወነ ማየት ከሆነ
አትውደዱ፣ አትለውጡ፣ በጸጥታም አትቆዩ። ለተጎዳው የግል መልዕክት ላኩ፦ “ይህ ስህተት ነው፣ ደህና ነህ?” ተጎዳውን መደገፍ የጨካዩን ኃይል ይሰብራል። ስክሪንሾት አድርጉና ዘግሩ።

## ጨካዩ ናንተ ከሆናችሁ
መቀበል ድፍረት ይጠይቃል። ይቅርታ ጠይቁ፣ ልጥፎቹን አጥፉ፣ ከአዋቂ ጋር ይነጋገሩ። ሁሉም ሰው የመመለስ መንገድ አለው።`,
    questions: [
      {
        promptEn: "Which of these is cyberbullying?",
        promptAm: "ከእነዚህ ውስጥ የኢንተርኔት ማስጨነቅ የትኛው ነው?",
        optionsEn: [
          "Beating a classmate in the school yard",
          "Repeatedly insulting a classmate in a group chat",
          "Arguing once about football",
          "Sending homework to a friend",
        ],
        optionsAm: [
          "በትምህርት ቤት ግቢ ውስጥ ተማሪ መደበድብ",
          "በግሩፕ ቻት ውስጥ ተማሪን ተደጋጋሚ ማሰደብ",
          "ስለ ኳስ አደር አንዴ መከራከር",
          "ለጓደኛ የቤት ስራ መላክ",
        ],
        answerIdx: 1,
        explainEn: "Cyberbullying is repeated harm through digital channels; a one-off disagreement is not.",
        explainAm: "የኢንተርኔት ማስጨነቅ በዲጂታል መሣሪያ የሚፈጸም ተደጋጋሚ ጉዳት ነው፤ አንድ ጊዜ አለመስማማት አይደለም።",
      },
      {
        promptEn: "Someone is bullying you online. What should you NOT do?",
        promptAm: "በኦንላይን ሰው እየጨነቀኝ ነው። የማደርገው የማይገባኝ ነገር የትኛው ነው?",
        optionsEn: [
          "Take screenshots as evidence",
          "Reply with worse insults",
          "Block the account",
          "Tell a teacher or parent",
        ],
        optionsAm: [
          "ማስረጃ ሆኖ ስክሪንሾት ማድረግ",
          "በከፋ ማሰደብ መመለስ",
          "መለያውን መከልከል",
          "ለመምህር ወይም ለወላጅ መንገር",
        ],
        answerIdx: 1,
        explainEn: "Insulting back feeds the cycle and can make you a rule-breaker too.",
        explainAm: "መስደብ ዑደቱን ያቀጣጥላልና እናንተም ደንብ መጣሻ ሊያደርጋችሁ ይችላል።",
      },
      {
        promptEn: "You witness a classmate being bullied in a group. The best action is to:",
        promptAm: "በግሩፕ ውስጥ ተማሪ እየተጨነቀ መሆኑን አየሁ። ምርጡ እርምጃ፦",
        optionsEn: [
          "Leave the group quietly",
          "Laugh so you fit in",
          "Support the target privately, screenshot, and report",
          "Add another comment",
        ],
        optionsAm: [
          "ግሩፑን በጸጥታ መልቀቅ",
          "እንደተስማማሁ ለማሳየት ማልቀስ",
          "ተጎዳውን በግል መደገፍ፣ ማስረጃ ማስቀመጥና ማመልከት",
          "ተጨማሪ አስተያየት መጨመር",
        ],
        answerIdx: 2,
        explainEn: "Bystanders who support the target and report change the outcome most.",
        explainAm: "ተመልካቾች ተጎዳውን መደገፍና ማመልከት ሲችሉ ውጤቱን ይቀይራሉ።",
      },
      {
        promptEn: "Why keep screenshots when reporting cyberbullying?",
        promptAm: "የኢንተርኔት ማስጨነቅን ለማመልከት ስክሪንሾትን ለምን ማቆየት ያስፈልጋል?",
        optionsEn: [
          "To post them publicly",
          "Because posts can be deleted — screenshots are the evidence",
          "To send them to the bully",
          "They look interesting",
        ],
        optionsAm: [
          "በይፋ ለማስቀመጥ",
          "ልጥፎች ሊጠፉ ስለሚችሉ — ስክሪንሾቹ ማስረጃ ናቸው",
          "ለጨካዩ ለመላክ",
          "አስደሳች ስለሚመስሉ",
        ],
        answerIdx: 1,
        explainEn: "Evidence lets adults and authorities act even after the bully deletes the posts.",
        explainAm: "ማስረጃ አዋቂዎችና ባለሥልጣናት ጨካዩ ልጥፎቹን ከሰረዘ በኋላም እንዲሠሩ ያስችላል።",
      },
    ],
  },
  {
    code: "AW-05",
    sortOrder: 5,
    topic: "personal_data",
    titleEn: "Your Personal Data and Privacy",
    titleAm: "የግል መረጃዎና ግላዊነት",
    summaryEn: "What personal data is, who wants it, why it is valuable, and the rights you hold over it.",
    summaryAm: "የግል መረጃ ምንድን ነው፣ ማን ይፈልገዋል፣ ለምን እሴት አለውና በእሱ ላይ ያላችሁ መብቶች።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## What counts as personal data
Your name, photo, phone number, school, home address, ID number, location, even the list of pages you like — all of it is personal data. Together it paints a picture of who you are.

## Why others want it
Companies use it to target advertising; scammers use it to build convincing lies ("I know your school, your mother's name..."). The more someone knows about you, the easier you are to manipulate.

## Data is like money
Treat personal information like birr from your pocket. Would you give your ID number to a stranger at the street? Then do not give it to a quiz app or a free-WiFi registration page either.

## Ethiopia protects you
The Personal Data Protection Proclamation No. 1321/2024 is Ethiopia's data-privacy law. It says organisations must collect only what they need, tell you why, keep it safe, and let you ask what they hold about you. It applies to schools, apps and websites alike.

## Practical habits
Use nicknames on games; give true details only to verified services that need them; read what permission an app asks for before tapping accept; decline what is not needed.`,
    contentAm: `## የግል መረጃ የሚባለው ምንድን ነው?
ስማችሁ፣ ፎቶዋችሁ፣ ስልክ ቁጥራችሁ፣ ትምህርት ቤታችሁ፣ የቤት አድራሻችሁ፣ የመታወቂያ ቁጥራችሁ፣ አካባቢያችሁ፣ የምትወዷቸው ገጾች እስከሆኑ — ሁሉም የግል መረጃ ነው። በጥም ሲሰበሰብ የማንነታችሁን ምስል ይለያል።

## ሌሎች ለምን ይፈልጉታል?
ኩባንያዎች ማስታወቂያ ለመመትት ይጠቀሙበታል፤ ሌቦች አሳማኝ ውሸት ለመሥራት (“ትምህርት ቤትህን፣ የእናትህን ስም አውቃለሁ…”)። ማንም በናንተ ላይ ብዙ ሲያውቅ በቀላሉ ማንጠቅጠቅ ይችላል።

## መረጃ እንደ ገንዘብ ነው
የግል መረጃን እንደ ከኪስና ብር አድርጉት። በመንገድ ላይ ለእንግዳ የመታወቂያ ቁጥራችሁን ትሰጣላችሁ? ካልሰጣችሁ ለጨዋታ መተግበሪያም ሆነ ለነፃ ዋይ-ፋይ ምዝገባ ገጽ እንዳትሰጡ።

## ኢትዮጵያ ትጠብቃላችሁ
የግል መረጃ ጥበቃ አዋጅ ቁጥር 1321/2024 የኢትዮጵያ የመረጃ ግላዊነት ሕግ ነው። ተቋማት ያስፈላጊውን ብቻ መሰብሰብ፣ ለምን መሆኑን መንገር፣ ደህንነቱን መጠበቅና ምን እንደያዙ መጠየቅ እንድትችሉ ይገድባል። ትምህርት ቤቶችን፣ መተግበሪያዎችንና ድረ-ገጾችን አካትቷል።

## ተግባራዊ ልማዶች
በጨዋታዎች ቅጽል ስም ይጠቀሙ፤ እውነተኛ ዝርዝር የሚያስፈልጋቸውን የተረጋገጡ አገልግሎቶች ብቻ፤ መተግበሪያ አዲስ ፈቃድ ከመጠየቁ በፊት የሚጠይቀውን ያንብቡ፤ ያስፈላጊውን አትቀበሉ።`,
    questions: [
      {
        promptEn: "Which of these is NOT personal data?",
        promptAm: "ከእነዚህ ውስጥ የግል መረጃ የማይሆነው የትኛው ነው?",
        optionsEn: [
          "Your phone number",
          "A photo of you in school uniform",
          "The current weather in Addis Ababa",
          "Your home address",
        ],
        optionsAm: [
          "ስልክ ቁጥራችሁ",
          "በትምህርት ቤት ልብስ ያለችሁ ፎቶ",
          "በአዲስ አበባ ያለው የአየር ሁኔታ",
          "የቤት አድራሻችሁ",
        ],
        answerIdx: 2,
        explainEn: "Public facts not linked to a person are not personal data; the rest identify you.",
        explainAm: "ከሰው ጋር ያልተያያቸው ይፋዊ እውነታዎች የግል መረጃ አይደሉም፤ ቀሪዎቹ ያሳያሉ።",
      },
      {
        promptEn: "A free quiz app asks for your contacts, photos and location. The wise reaction is to:",
        promptAm: "ነፃ የጨዋታ መተግበሪያ እውቂያዎቻችሁን፣ ፎቶዎቻችሁንና አካባቢያችሁን ይጠይቃል። ጥበብ ያለው ምላሹ፦",
        optionsEn: [
          "Accept — the app is free, so it is fair",
          "Decline: a quiz needs none of that",
          "Give location only",
          "Ask friends what they did",
        ],
        optionsAm: [
          "መቀበል — መተግበሪያው ነፃ ስለሆነ ፍትሃዊ ነው",
          "መቀበል የለም፦ ጨዋታው ምንም ከእነዚህ አያስፈልገውም",
          "አካባቢውን ብቻ መስጠት",
          "ጓደኞች ምን እንዳደረጉ መጠየቅ",
        ],
        answerIdx: 1,
        explainEn: "Permissions beyond the app's purpose are a data-collection red flag; free does not mean harmless.",
        explainAm: "ከዓላማው በላይ የፈቃድ ጥያቄ የመረጃ ሰብሰብ ምልክት ነው፤ ነፃ ማለት ጉዳት የለሽ ማለት አይደለም።",
      },
      {
        promptEn: "What does Ethiopia's Proclamation No. 1321/2024 require of organisations?",
        promptAm: "የኢትዮጵያ አዋጅ ቁጥር 1321/2024 ከተቋማት ምን ይጠይቃል?",
        optionsEn: [
          "Collect as much data as possible",
          "Collect only what is needed, explain why, keep it secure",
          "Share data with advertisers",
          "Store data forever",
        ],
        optionsAm: [
          "በሚቻለው ሁሉ መረጃ መሰብሰብ",
          "ያስፈላጊውን ብቻ መሰብሰብ፣ ለምን መሆኑን ማብራራት፣ ደህንነቱን መጠበቅ",
          "መረጃን ከማስታወቂያ ሰጪዎች ጋር ማጋራት",
          "መረጃን ለዘላለም ማከማቸት",
        ],
        answerIdx: 1,
        explainEn: "The law follows data-minimisation, transparency and security duties — the same rules this platform's banks follow.",
        explainAm: "ሕጉ የመረጃ ቅነሳ፣ ግልጽነትና የደህንነት ግዴታዎችን ይከተላል — በዚህ መድረክ ባንኮች የሚከተሉትም ተመሳሳይ ደንቦች ናቸው።",
      },
      {
        promptEn: "The safest username for an online game is:",
        promptAm: "ለኦንላይን ጨዋታ የተሻለው የተጠቃሚ ስም፦",
        optionsEn: [
          "SelamBekele2009_Addis",
          "BlueTiger42",
          "My real full name",
          "My phone number",
        ],
        optionsAm: [
          "ሰላምበቀለ2009_አዲስ",
          "BlueTiger42",
          "እውነተኛ ሙሉ ስሜ",
          "ስልክ ቁጥሬ",
        ],
        answerIdx: 1,
        explainEn: "A nickname carries no identity clues; names, birth years and numbers help strangers find the real you.",
        explainAm: "ቅጽል ስም የማንነት ፍንጭ አያስተላልፍም፤ ስም፣ የተወለዱበት ዓመትና ቁጥር እንግዳ እውነተኛውን ሰው እንዲያገኙ ይረዳሉ።",
      },
    ],
  },
  {
    code: "AW-06",
    sortOrder: 6,
    topic: "safe_browsing",
    titleEn: "Safe Browsing and Downloads",
    titleAm: "ደህንነቱ የተጠበቀ አሰሳና ማውረድ",
    summaryEn: "HTTPS, fake download buttons, free-WiFi traps, and how to keep a phone or laptop clean.",
    summaryAm: "HTTPS፣ ውሸታማ የማውረጃ አዝራሮች፣ የነፃ ዋይ-ፋይ ወጥመዶችና ስልክ ወይም ላፕቶፕ ንጹህ ማድረግ።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## The padlock means encrypted
Addresses starting with https:// scramble the traffic between you and the site. Never type passwords or payment details on a page that is only http:// — anyone on the network can read it.

## The fake download button
On free download pages the biggest, brightest button is often an advertisement that installs junk. Look at the address the button points to before clicking; prefer official app stores (Play Store, App Store).

## Free WiFi is a listening ear
On public WiFi, assume others can watch. Do not log in to bank or school accounts on cafe or airport WiFi; if you must, use your mobile data instead.

## Keep everything updated
Updates are not new features — they close holes attackers already know about. Let your phone update its apps and system. Say yes to updates, quickly.

## If a download happened anyway
Disconnect the internet, tell an adult, run a scan. Watch for strange behaviour: fast battery drain, pop-ups, apps you did not install.`,
    contentAm: `## መቆለፊያ ማለት ተመስብሯል ማለት ነው
በhttps:// የሚጀምሩ አድራሻዎች በናንተና በገጹ መካከል ያለውን መረጃ ያመሰቅልቃሉ። በhttp:// ብቻ በሚጀምር ገጽ ላይ የይለፍ ቃል ወይም የክፍያ ዝርዝር በጭራሽ አትጻፉ — በአውታረ መረቡ ላይ ያለ ማንኛውም ሰው ማንበብ ይችላል።

## ውሸታማው የማውረጃ አዝራር
በነፃ ማውረጃ ገጾች ላይ ትልቁና ደማቁ አዝራር ብዙ ጊዜ ብልጽግና የሚጭን ማስታወቂያ ነው። ከመጫናችሁ በፊት አዝራሩ ወደሚመራበት አድራሻ ይመልከቱ፤ ይፋዊ የመተግበሪያ መደብሮችን (Play Store፣ App Store) መርጡ።

## ነፃ ዋይ-ፋይ የማዳመጥ ጆሮ ነው
በይፋዊ ዋይ-ፋይ ላይ ሰዎች እየተመለከቱ ናቸው ብላችሁ ግምት አድርጉ። በካፌ ወይም አውሮፕላን ማረፊያ ዋይ-ፋይ ላይ የባንክ ወይም የትምህርት መለያ አትግቡ፤ ከቀረ የሞባይል ዳታችሁን ይጠቀሙ።

## ሁሉንም ያዘምኑ
ማዘመን አዲስ ባህርያት አይደለም — ጠላቆች አስቀድሞ በሚያውቁት ቀዳይ ይዘጋል። ስልካችሁ መተግበሪያዎቹንና ሥርዓቱን እንዲያዘምን ፍቀዱ። ለማዘመን በፍጥነት “አዎ” በሉ።

## ማውረድ ቢከሰት ነገር ግን
ኢንተርኔቱን ያግዱ፣ ለአዋቂ ንገሩ፣ ስካን ያሂዱ። ያልጫናችሁ መተግበሪያዎች፣ በፍጥነት የሚሟጠጥ ባትሪ፣ ብዙ ብልጭታዎች — ተጠንቀቁ።`,
    questions: [
      {
        promptEn: "Which address is safe for typing a password?",
        promptAm: "የይለፍ ቃል ለመጻፍ ደህንነቱ የተጠበቀው የትኛው አድራሻ ነው?",
        optionsEn: ["http://school-login.com", "https://school.gov.et", "school-login.info.tk", "192.168.0.1/login"],
        optionsAm: ["http://school-login.com", "https://school.gov.et", "school-login.info.tk", "192.168.0.1/login"],
        answerIdx: 1,
        explainEn: "https:// encrypts the session; plain http and odd-looking domains invite eavesdroppers.",
        explainAm: "https:// ክፍለ ጊዜውን ያመሰቅልቃል፤ ባዶ httpና ያልተለመዱ ገጾች ማዳመጣን ይጋብዛሉ።",
      },
      {
        promptEn: "On a free-download page, the huge green 'DOWNLOAD NOW' button is most likely:",
        promptAm: "በነፃ ማውረጃ ገጽ ላይ ትልቁ አረንጓዴ “አሁኑኑ አውርድ” አዝራር ብዙ ጊዜ፦",
        optionsEn: [
          "The real download",
          "An advertisement that installs junk",
          "A virus scanner",
          "A survey",
        ],
        optionsAm: [
          "እውነተኛው ማውረድ",
          "ብልጽግና የሚጭን ማስታወቂያ",
          "ቫይረስ ማጥፊያ",
          "የአሰብታ ጥያቄ",
        ],
        answerIdx: 1,
        explainEn: "Ad buttons imitate download buttons; check where the link really goes or use the official store.",
        explainAm: "የማስታወቂያ አዝራሮች የማውረጃ አዝራር ይስባሉ፤ አገናኙ ወዴት እንደሚሄድ ይመልከቱ ወይም ይፋዊ መደብር ይጠቀሙ።",
      },
      {
        promptEn: "You need to check school results using cafe WiFi. The safer choice is to:",
        promptAm: "የካፌ ዋይ-ፋይ በመጠቀም የትምህርት ውጤት ማየት አለብኝ። የተሻለው ምርጫ፦",
        optionsEn: [
          "Log in anyway, quickly",
          "Use your own mobile data for the login",
          "Ask the cafe staff to log in",
          "Save the password in the browser",
        ],
        optionsAm: [
          "ቢፈጥንም ቢሆን መግባት",
          "ለመግቢያው የራሳችሁን ሞባይል ዳታ መጠቀም",
          "የካፌውን ሠራተኛ መጠየቅ",
          "የይለፍ ቃሉን በአሳሹ ማስቀመጥ",
        ],
        answerIdx: 1,
        explainEn: "Mobile data keeps your credentials off a shared network you cannot audit.",
        explainAm: "ሞባይል ዳታ የመግቢያ መረጃችሁን ከማይቆጣጠሩት የጋራ አውታረ መረብ ይጠብቃል።",
      },
      {
        promptEn: "Why install app and system updates quickly?",
        promptAm: "የመተግበሪያና የሥርዓት ማዘመኖችን ለምን በፍጥነት መትከል አለብኝ?",
        optionsEn: [
          "They add new games",
          "They close security holes attackers already know",
          "They make the phone heavier",
          "They are required by the school",
        ],
        optionsAm: [
          "አዲስ ጨዋታ ስለሚጨምሩ",
          "ጠላቆች አስቀድሞ በሚያውቋቸው የደህንነት ቀዳዮች ይዘጋሉ",
          "ስልኩን የከባድ ስለሚያደርጉት",
          "በትምህርት ቤት ስለሚጠየቅ",
        ],
        answerIdx: 1,
        explainEn: "Most real-world attacks reuse old, already-patched holes; updating removes their door.",
        explainAm: "አብዛኞች ጥቃቶች ድሮ የተዘጉ ቀዳዮችን ይመልሳሉ፤ ማዘመን በርቸውን ይዘጋል።",
      },
    ],
  },
  {
    code: "AW-07",
    sortOrder: 7,
    topic: "device_security",
    titleEn: "Device Security",
    titleAm: "የመሣሪያ ደህንነት",
    summaryEn: "Screen locks, app permissions, finding a lost phone, and keeping others out of your device.",
    summaryAm: "የስክሪን ቁልፍ፣ የመተግበሪያ ፈቃዶች፣ የጠፋ ስልክ ማግኘትና ሌሎችን ከመሣሪያዎ ማስወገድ።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## Lock the front door
A phone without a screen lock is a wallet without a zip. Use a PIN of 6+ digits, a pattern that is not a letter Z, or a fingerprint. Set the screen to lock in 30 seconds.

## Permission patrol
Open your phone's settings and read what each app may do. A torch app needs the flash — not your contacts, messages or microphone. Revoke anything that does not fit the app's job.

## Lost device plan
Before it happens: turn on Find My Device, note the IMEI (dial *#06#), and set a lock-screen message with a contact number. After it happens: use Find My Device to locate or wipe, tell your parents, and have the SIM blocked by the operator.

## Lending is leaking
A friend can read your chats in ten seconds; a charging point can install things if you approve prompts half-asleep. Charge from a wall socket, not a stranger's computer, and never tap "allow" on a prompt you did not expect.

## Backups
Save schoolwork and photos to a family cloud or drive. Ransomware and lost phones hurt far less when a copy exists.`,
    contentAm: `## ዋናውን በር ቁልፍ
ያለ የስክሪን ቁልፍ ስልክ ያለ ዚፕ ከሚታጠፍ ዋሌት ነው። ከ6 በላይ የፒን ቁጥር፣ ፊደል ያልሆነ ስርዓት (pattern) ወይም የአሻንጉልት አሻራ ይጠቀሙ። ስክሪኑ በ30 ሰከንድ ውስጥ ራሱ እንዲቆለፍ አድርጉት።

## የፈቃድ ቁጥጥር
የስልክ ማደሪያውን ክፈቱትና እያንዳንዱ መተግበሪያ ምን እንደሚችል ያንብቡ። የመብራት መብራት መተግበሪያ ፈላሽ ያስፈልገዋል — እውቂያዎቻችሁን፣ መልዕክቶቻችሁን ወይም ማይክሮፎን አያስፈልገውም። ከሥራው ጋር ያልተጣጣመን ሁሉ ይክዱ።

## የጠፋ መሣሪያ ዕቅድ
ከመከሰቱ በፊት፦ Find My Device አንቁት፣ የIMEI ቁጥሩን ጻፉ (በ*#06# ይደውሉ)፣ ከመገናኛ ቁጥር ጋር የስክሪን ማስታወሻ አድርጉ። ከተከሰተ በኋላ፦ በFind My Device ፈልጉ ወይም አጥፉ፣ ለወላጆችዎ ንገሩ፣ ሲም እንዲታገድ ለኦፕሬተሩ ያሳውቁ።

## መበደር መፍሰስ ነው
ጓደኛ በአሥር ሰከንድ ውስጥ ቻቶችን ማንበብ ይችላል፤ ግማሽ ተኝቶ የተጠየቀ ፈቃድም ቢሆን መቀበል ስህተት ነው። ከሰው ኮምፒውተር ሳይሆን ከግድግዳ ቀይ ያሽጁ፣ ያላመናችሁበት ጥያቄ “ፍቀድ” በጭራሽ አትንኩ።

## መጠባበቂያ
የትምህርት ሥራና ፎቶዎችን ወደ ቤተሰብ ክላውድ ወይም ድራይቭ ያስቀምጡ። ኮፒ ሲኖር ራንሶምዌርና የጠፋ ስልክ ብዙ አያሳምሙም።`,
    questions: [
      {
        promptEn: "Which screen lock is strongest?",
        promptAm: "የትኛው የስክሪን ቁልፍ ጠንካራ ነው?",
        optionsEn: ["Swipe only", "Pattern shaped like the letter Z", "6+ digit PIN or fingerprint", "No lock"],
        optionsAm: ["መጎተት ብቻ", "ፊደል Z ቅርጽ ያለው pattern", "ከ6 በላይ የፒን ቁጥር ወይም አሻራ", "ያለ ቁልፍ"],
        answerIdx: 2,
        explainEn: "Simple patterns and swipes are guessed from screen smudges; long PINs and biometrics resist.",
        explainAm: "ቀላል ስርዓቶች ከስክሪን ወፈር ይገመታሉ፤ ረጅም ፒንና አሻራ ይቋቋማሉ።",
      },
      {
        promptEn: "A torch (flashlight) app asks for your contacts and messages. You should:",
        promptAm: "የመብራት መብራት መተግበሪያ እውቂያዎቻችሁንና መልዕክቶቻችሁን ይጠይቃል። ማድረግ ያለበለት፦",
        optionsEn: [
          "Allow — apps need permissions",
          "Refuse: a torch needs only the flash",
          "Allow contacts only",
          "Pay for the app instead",
        ],
        optionsAm: [
          "መፍቀድ — መተግበሪያዎች ፈቃድ ያስፈልጋቸዋል",
          "መቀበል የለም፦ መብራት መብራት ፈላሹን ብቻ ያስፈልገዋል",
          "እውቂያዎችን ብቻ መፍቀድ",
          "መተግበሪያውን መክፈል",
        ],
        answerIdx: 1,
        explainEn: "Permissions must match purpose; anything extra is harvesting.",
        explainAm: "ፈቃድ ከዓላማ ጋር መጣጣም አለበት፤ ተጨማሪው ሁሉ መሰብሰብ ነው።",
      },
      {
        promptEn: "Your phone is lost. Which step belongs to the AFTER list?",
        promptAm: "ስልካችሁ ጠፋ። የ“ከዚያ በኋላ” ዝርዝር የሚመደበው የትኛው ነው?",
        optionsEn: [
          "Turning on Find My Device",
          "Noting the IMEI number",
          "Asking the operator to block the SIM",
          "Setting a lock-screen message",
        ],
        optionsAm: [
          "Find My Device ማንቀሳቀስ",
          "የIMEI ቁጥር መጻፍ",
          "ሲሙ እንዲታገድ ኦፕሬተሩን መጠየቅ",
          "የስክሪን ማስታወሻ ማዘጋጀት",
        ],
        answerIdx: 2,
        explainEn: "Locating, IMEI notes and lock messages are preparation; blocking the SIM is the post-loss step.",
        explainAm: "መፈለግ፣ የIMEI መጻፍና የስክሪን ማስታወሻ ዝግጅት ናቸው፤ ሲም ማገድ የከሰተ በኋላ እርምጃ ነው።",
      },
      {
        promptEn: "Why charge your phone from a wall socket rather than a stranger's computer?",
        promptAm: "ስልካችሁን ከሰው ኮምፒውተር ሳይሆን ከግድግዳ ቀይ ለምን ማሽጠር አለብኝ?",
        optionsEn: [
          "It is faster",
          "A computer can push data or prompts to the phone while charging",
          "Wall sockets are cheaper",
          "Computers overcharge phones",
        ],
        optionsAm: [
          "ፈጣን ስለሆነ",
          "ኮምፒውተር ሲያቀልጥ ወደ ስልኩ መረጃ ወይም ጥያቄ ሊልክ ይችላል",
          "የግድግዳ ቀይ ርካሽ ስለሆነ",
          "ኮምፒውተሮች ስልክን ያመዛሉ",
        ],
        answerIdx: 1,
        explainEn: "A USB cable is a data cable too; untrusted computers can attempt installs or prompt attacks.",
        explainAm: "የUSB ገመድ የመረጃ ገመድም ነው፤ ያልታመነ ኮምፒውተር መጫን ወይም ጥያቄ ሊሞክር ይችላል።",
      },
    ],
  },
  {
    code: "AW-08",
    sortOrder: 8,
    topic: "reporting",
    titleEn: "When Something Goes Wrong — Reporting",
    titleAm: "ችግር ሲከሰት — ማመልከቻ",
    summaryEn: "The five golden steps after a hack, scam or bullying event, and who in Ethiopia can help.",
    summaryAm: "ድክመት፣ ማጭበርበር ወይም ማስጨነቅ ከተከሰተ በኋላ የአምስቱ ወርቃማ እርምጃዎችና በኢትዮጵያ የሚረዱ አካላት።",
    durationMin: 15,
    gradeBand: "7-10",
    audience: "KIDS",
    contentEn: `## Bad things happen to careful people
Clicking one wrong link does not make you stupid — staying silent makes it worse. Every security team in the world says the same thing: report early, fix early.

## The five golden steps
1. Stop using the account or device for anything secret.
2. Tell a trusted adult immediately (parent, teacher, ICT staff).
3. Change the password from a DIFFERENT, clean device.
4. Keep evidence: screenshots, message times, receipt numbers.
5. Report to the right authority.

## Who can help in Ethiopia
- Your school's IT teacher or counsellor.
- Your bank's official fraud line (number printed on your card or passbook — never from a message).
- Ethio-CERT — the national computer emergency response team, which receives incident reports from the public.
- For crimes (theft, threats, blackmail), the police cybercrime desk.

## Money already left?
If a payment was scammed, contact the bank within minutes: transfers can sometimes be frozen. Bring the receipt number, time and the receiving account. Speed matters more than shame.

## Practise the words
"My account may be hacked — I need help." Saying it early is a strength, not a weakness.`,
    contentAm: `## ጥንቃቄ ላይ ለሰዎችም መጥፎ ነገር ይከሰታል
አንድ የተሳሳተ አገናኝ መንካት ሁኪ ማድረግ አያደርጋችሁም — በጸጥታ መያዙ ያሳዳርገዋል። በዓለም የደህንነት ቡድኖች ሁሉ ተመሳሳይ ነገር ይላሉ፦ ቀድመህ አመልክት፣ ቀድመህ አስተካክል።

## አምስቱ ወርቃማ እርምጃዎች
1. መለያውን ወይም መሣሪያውን ለምስጢር አትጠቀሙ።
2. ወዲያውኑ ለሚያምኑበት አዋቂ ንገሩ (ወላጅ፣ መምህር፣ የአይሲቲ ሠራተኛ)።
3. የይለፍ ቃሉን ከሌላ ንጹህ መሣሪያ ቀይሩ።
4. ማስረጃ ያዙ፦ ስክሪንሾት፣ የመልዕክት ጊዜዎች፣ የደረሰኝ ቁጥሮች።
5. ለትክክለኛው አካል ዘግሩ።

## በኢትዮጵያ የሚረዱአችሁ
- የትምህርት ቤታችሁ የአይቲ መምህር ወይም አማካሪ።
- የባንካችሁ ይፋዊ የማጭበርበር ቀጥታ (በካርዳችሁ ወይም በባንክ ደብተራችሁ ላይ የታተመው ቁጥር — ከመልዕክት በፍጹም አይሆንም)።
- ኢትዮ-ሴርት — ከሕዝብ የችግር ሪፖርት የሚቀበል ብሔራዊ የኮምፒውተር ድንገተኛ አገልግሎት ቡድን።
- ለወንጀሎች (ስርቆት፣ ዛቻ፣ ጥቃት) — የፖሊስ የሳይበር ወንጀል ክፍል።

## ገንዘብ አልፎ ሲሄድ?
ክፍያ ተታልሎ ከሆነ፣ በደቂቆች ውስጥ ባንኩን ያግኙ፦ ዝውው አንዳንዴ ሊቆለፍ ይችላል። የደረሰኝ ቁጥሩን፣ ጊዜውንና የተቀበለውን ሂሳብ ይያዙ። ፍጥነት ከውርደት ይበልጣል።

## ቃላቱን አስተምሩ
“መለያዬ ሊበረዳ ይችላል — እርዳታ ያስፈልገኛል።” ቀድሞ መናገር ደኅንነት ነው ደካማነት አይደለም።`,
    questions: [
      {
        promptEn: "Right after noticing your account is hacked, the FIRST step is to:",
        promptAm: "መለያችሁ ተበድቷል ማለት ስታውቁ ወዲያውኑ የመጀመሪያ እርምጃ፦",
        optionsEn: [
          "Post about it on social media",
          "Stop using it for secrets and tell a trusted adult",
          "Delete everything",
          "Buy a new phone",
        ],
        optionsAm: [
          "በማህበራዊ ሚዲያ ማስታወቂያ ማድረግ",
          "ለምስጢር አትጠቀሙበትም እና ለሚያምኑበት አዋቂ መንገር",
          "ሁሉንም መሰረዝ",
          "አዲስ ስልክ መግዛት",
        ],
        answerIdx: 1,
        explainEn: "Containment plus an adult stops the damage from growing while recovery is arranged.",
        explainAm: "መያዝና አዋቂ ማሳወቅ ጉዳቱ እየጨመረ ሳይሆን እርምጃ እንዲወሰድ ያደርጋል።",
      },
      {
        promptEn: "Who is Ethio-CERT?",
        promptAm: "ኢትዮ-ሴርት ማን ነው?",
        optionsEn: [
          "A private antivirus company",
          "Ethiopia's national computer emergency response team",
          "A social media platform",
          "A bank department",
        ],
        optionsAm: [
          "የግል አንቲቫይረስ ኩባንያ",
          "የኢትዮጵያ ብሔራዊ የኮምፒውተር ድንገተኛ ምላሽ ቡድን",
          "የማህበራዊ ሚዲያ መድረክ",
          "የባንክ ክፍል",
        ],
        answerIdx: 1,
        explainEn: "Ethio-CERT is the national CERT the platform's SOC synchronises with; it also takes public reports.",
        explainAm: "ኢትዮ-ሴርት መድረኩ SOC ከሚመሳሰለው ብሔራዊ CERT ነው፤ ከሕዝብ ሪፖርትም ይቀበላል።",
      },
      {
        promptEn: "A scammer took money from your family. Why contact the bank within minutes?",
        promptAm: "ሌባ ከቤተሰባችሁ ገንዘብ ወሰደ። ለምን በደቂቆች ውስጥ ባንኩን ማግኘት አለብኝ?",
        optionsEn: [
          "Banks close early",
          "Transfers can sometimes still be frozen",
          "To get a new card",
          "To complain about interest rates",
        ],
        optionsAm: [
          "ባንኮች ቀድሞ ስለሚዘጉ",
          "ዝውው አንዳንዴ አሁንም ሊቆለፍ ይችላል",
          "አዲስ ካርድ ለማግኘት",
          "ስለ ወለድ መቅረት ለማድረግ",
        ],
        answerIdx: 1,
        explainEn: "Speed gives the bank a window to freeze the transfer before it is withdrawn.",
        explainAm: "ፍጥነት ከመውጣቱ በፊት ዝውዉን ለማቆለፍ ወደ ባንኩ ያስተላልፋል።",
      },
      {
        promptEn: "Which set contains ALL five golden steps?",
        promptAm: "አምስቱ ወርቃማ እርምጃዎች በሙሉ ያሉት ማናቸው ናቸው?",
        optionsEn: [
          "Stop, tell an adult, change password, keep evidence, report",
          "Post, argue, delete, ignore, forget",
          "Pay, wait, hope, retry, sleep",
          "Run, hide, shout, cry, quit",
        ],
        optionsAm: [
          "አቁም፣ ለአዋቂ ንገር፣ የይለፍ ቃል ቀይር፣ ማስረጃ ያዝ፣ ዘግር",
          "ለጥፍ፣ ከራ፣ ሰርዝ፣ ተው፣ ረሳ",
          "ክፈል፣ ጠብቅ፣ ተስፋ አድርግ፣ ደግመህ ሞክር፣ ተኝ",
          "ሮጥ፣ ተሸሽ፣ ጮህ፣ አለቅስ፣ ተው",
        ],
        answerIdx: 0,
        explainEn: "Contain, escalate, re-secure, evidence, report — the order matters.",
        explainAm: "ያዝ፣ አሳውቅ፣ እንደገና አስተናግድ፣ ማስረጃ፣ ዘግር — ቅደም ተከተሉ ጠቃሚ ነው።",
      },
    ],
  },
];

/* ── Audience-track extensions (proposal Table 22) ──────────────────────────
 * The five-school pilot curriculum above is the CyberSafe Kids programme and
 * carries the fixed 16-item RQ2 instrument. The units below extend the
 * platform to the other three audiences of the proposal's module
 * architecture: CyberSmart Teens (grades 9–12, Amharic + English), CyberPro
 * (university / technical college, English) and CyberAware (SME staff and
 * government employees, Amharic + English). They are supplementary learning
 * and never enter the RQ2 instrument (see resolveInstrument, pinned to the
 * KIDS pilot curriculum). */

export const AWARENESS_MODULES_TEENS: ModuleSeed[] = [
  {
    code: "AW-09",
    sortOrder: 9,
    topic: "sextortion",
    audience: "TEENS",
    titleEn: "Sextortion: Recognise It, Respond Right",
    titleAm: "ስክስቶርሽን፦ አውቀው በትክክል ምላሽ ስጥ",
    summaryEn: "How online extortion of teenagers really works in East Africa, why paying never ends it, and the response protocol INTERPOL recommends.",
    summaryAm: "የወጣቶች የመስመር ላይ ጣልቃ ገብነት በምሥራቅ አፍሪካ እንዴት እንደሚሠራ፣ መክፈል ለምን የማያበቃው፣ እና ኢንተርፖል የሚመክረው የምላሽ እርምጃ።",
    durationMin: 20,
    gradeBand: "9-12",
    contentEn: `## What sextortion is
Sextortion is blackmail: someone obtains or pretends to obtain an intimate image of you, then demands money or more images by threatening to send it to your family, school or friends. INTERPOL's casework across East Africa shows teenage boys and girls are both targeted, often by organised groups working from scripts.

## The pattern to recognise
It almost always follows the same shape. First, a friendly stranger follows you and showers you with compliments. Second, they push to move the chat to private channels very quickly. Third, they ask for an intimate photo — sometimes after sending one themselves, which is usually stolen. Fourth, the moment they have the image (or claim to), the mask drops: money or more images, with a deadline.

## The most important fact
Victims who pay are almost always extorted again. Payment proves the threat works, so the demands continue and escalate. The same is true for sending more images. There is no purchase of silence — only reporting ends it.

## If it happens to you
Stop replying. Do not pay. Keep every message, the account name, and any payment details — do not delete anything, even though you want to. Tell a trusted adult the same day. Then report: inside the app, to the police cybercrime desk, and to Ethio-CERT. You are the victim of a crime, not the person at fault — this is exactly how the law and every adult who matters will see it.

## Practise it safely
Use the Sextortion Response Trainer in the AI Tools section of this portal. It walks you through a fictional case so that if a real one ever starts, your response is already rehearsed.`,
    contentAm: `## ስክስቶርሽን ምንድን ነው?
ስክስቶርሽን ብድር ነው፦ ሰው የአንተን የግል ምስል ያገኛል ወይም እንዳገኘ ያስመስላል፣ ከዚያ ገንዘብ ወይም ተጨማሪ ምስሎች በመጠየቅ ለቤተሰብህ፣ ለትምህርት ቤት ወይም ለጓደኞችህ እንደሚልክ ያስፈራል። በምሥራቅ አፍሪካ የኢንተርፖል ጉዳዮች የሁለቱም ጾታ ወጣቶች መላላኪያ እንደሆኑ፣ ብዙ ጊዜ በቅድመ-ዝግጅት በሚሠሩ ቡድኖች መሳተፋቸውን ያሳያሉ።

## የሚታወቅበት ንድፍ
በተራርኳችሁ ጊዜ ተመሳሳይ ቅርጽ ይከተላል። በመጀመሪያ ያልታወቅን ጓደኛ ይከተልሃልና ብዙ እንክብካቤ ያሳያል። ሁለተኛ ወደ ግል ውይይት በፍጥነት ለመሸጋገር ይገፋፋል። ሦስተኛ የግል ምስል ይጠይቃል — አንዳንዴ የራሱን ልኮ የሚያሳይ ነገር ግን የተሰረቀ ነው። አራተኛ ምስሉን ሲያገኝ (ወይም እንዳገኘ ሲል) ፊቱ ይቀየራል፦ ገንዘብ ወይም ተጨማሪ ምስል፣ በጊዜ ገደብ።

## በጣም አስፈላጊው እውነታ
የከፈሉ ተማሪዎች በአብዛኛው ደግሞ ይጠየቃሉ። ክፍያ ማስፈራቱ እንደሚሠራ ማረጋገጫ በመሆኑ ጥያቄዎቹ ይቀጥላሉና ይጨምራሉ። ተጨማሪ ምስል መላክም እንዲሁ ነው። ጸጥታ መግዛት የለም — ሪፖርት ብቻ ነው የሚያበቃው።

## በደረሰብህ ከሆነ
መመለስን አቁም። አትክፈል። እያንዳንዱን መልዕክት፣ የመለያ ስሙንና የክፍያ ዝርዝሮችን ያዝ — ምንም አትሰርዝ፣ ብትፈልግም ቢሆን። በዚያው ቀን ለሚታመን አዋቂ ንገር። ከዚያ ሪፖርት አድርግ፦ በመተግበሪያው ውስጥ፣ ለፖሊስ የሳይበር ወንጀል ክፍል፣ እና ለኢትዮ-ሴርት። የወንጀል መሳዋ ነህ — በድል የሚደረግበት በፍጹም አይደለም፤ ሕጉም፣ አስፈላጊው አዋቂም በዚህ አይነት አመለካከት ያያሉ።

## በደህና ተለማመድበት
በዚህ በርታል በ AI መሳሪያዎች ክፍል ውስጥ ያለውን የስክስቶርሽን ምላሽ ልምምድ ተጠቀም። ምናባዊ ጉዳይ ያሻግርሃል፤ እውነተኛ ከመጀመሩ በፊት ምላሽህ ተለምዶ እንዲሆን።`,
    questions: [
      {
        promptEn: "A blackmailer with your private photo demands 10,000 birr tonight. What does INTERPOL's evidence say happens if you pay?",
        promptAm: "የግል ምስልህን ያዘ ጠባቂ ዛሬ ማታ 10,000 ብር ይጠይቅሃል። ከፍልክ ከፈልክ ምን ይከሰታል እንደሚል የኢንተርፖል ማስረጃ ይናገራል?",
        optionsEn: [
          "He deletes it and disappears",
          "He demands more, again and again",
          "He reports himself to the police",
          "He shares it anyway but apologises",
        ],
        optionsAm: [
          "ሰርዞ ይጠፋል",
          "ደግሞ ደግሞ ይጠይቃል",
          "ራሱን ለፖሊስ ሪፖርት ያደርጋል",
          "ቢልክም እየተፈቀደ ያሳያዋል",
        ],
        answerIdx: 1,
        explainEn: "Payment proves the threat works — the documented pattern is repeated and escalating demands, never a clean ending.",
        explainAm: "ክፍያ ማስፈራቱ እንደሚሠራ ማረጋገጫ ነው — የተመዘገበው ንድፍ ደግሞ ደግሞ የሚጨምሩ ጥያቄዎች ናቸው፣ ንጹህ መጨረሻ በጭራሽ አይደለም።",
      },
      {
        promptEn: "Which is the safest first move when the threats start?",
        promptAm: "ማስፈራራቱ ሲጀመር የመጀመሪያው ደህና እርምጃ የትኛው ነው?",
        optionsEn: [
          "Reply and negotiate a smaller amount",
          "Stop replying, keep all evidence, tell a trusted adult today",
          "Delete the chat so nobody ever sees it",
          "Block him, then wait a week and see",
        ],
        optionsAm: [
          "መልሰህ ስምምነት ላይ ግባ",
          "መመለስ አቁም፣ ሁሉንም ማስረጃ ያዝ፣ ዛሬ ለሚታመን አዋቂ ንገር",
          "ውይይቱን ሰርዘህ ማንም እንዳያው",
          "ከልክለው ሳምንት ጠብቀህ ተመልከት",
        ],
        answerIdx: 1,
        explainEn: "Silence (not negotiation), evidence (not deletion) and a trusted adult on day one — that trio ends these cases.",
        explainAm: "ጸጥታ (ያለ ድርድር)፣ ማስረጃ (ያለ መሰረዝ) እና በመጀመሪያው ቀን የሚታመን አዋቂ — እነዚህ ሦስት ነገሩ ያበቃሉ።",
      },
      {
        promptEn: "Where should a sextortion case in Ethiopia be reported?",
        promptAm: "በኢትዮጵያ የስክስቶርሽን ጉዳይ ወዴት ሪፖርት ይደረጋል?",
        optionsEn: [
          "Nowhere — it is too embarrassing",
          "Only inside the app",
          "The app, the police cybercrime desk, and Ethio-CERT",
          "To the blackmailer's friends",
        ],
        optionsAm: [
          "ወዴትም አይደለም — በጣም ያሳፍራልና",
          "በመተግበሪያው ውስጥ ብቻ",
          "በመተግበሪያው፣ በፖሊስ የሳይበር ወንጀል ክፍልና በኢትዮ-ሴርት",
          "ለጠባቂው ጓደኞች",
        ],
        answerIdx: 2,
        explainEn: "The platform can suspend the account, the police can trace payment numbers, and Ethio-CERT coordinates nationally. All three, plus a trusted adult.",
        explainAm: "መድረኩ መለያውን ማገድ ይችላል፣ ፖሊስ የክፍያ ቁጥሮችን መከታተል ይችላል፣ ኢትዮ-ሴርትም በብሔር ደረጃ ያስተባብራል። ሦስቱም ከሚታመን አዋቂ ጋር።",
      },
    ],
  },
  {
    code: "AW-10",
    sortOrder: 10,
    topic: "digital_footprint",
    audience: "TEENS",
    titleEn: "Your Digital Footprint Follows You",
    titleAm: "የዲጂታል ዱካህ ይከተልሃል",
    summaryEn: "What your posts, tags and settings reveal about you years later — and your rights over your own data under Proclamation 1321/2024.",
    summaryAm: "ልጥፎችህ፣ ማስታወሻዎችና ማስተካከያዎችህ በኋላ ዓመታት ስለ አንተ ምን እንደሚናገሩ — እና በአዋጅ 1321/2024 ሥር ባለው መረጃህ ላይ ያለህ መብቶች።",
    durationMin: 15,
    gradeBand: "9-12",
    contentEn: `## Everything leaves a trace
Your digital footprint is everything you leave behind online: posts, comments, likes, photos with location tags, app permissions, old usernames. Unlike footprints in sand, these do not wash away — they are copied, archived and resurfaced by search engines years later, exactly when a university, an employer or a journalist looks you up.

## Two kinds of footprint
Your active footprint is what you post deliberately. Your passive footprint is what others post about you, and what systems collect silently: tagged photos, location metadata inside images, friend lists, app analytics. You control the first directly; the second only through settings, review and asking friends to untag.

## The permanence rule
Before posting, apply the test: would I be comfortable if my future employer, my family, or a stranger read this in five years? If not, do not post it. Deleting is not deleting — screenshots and archives exist.

## Your rights in Ethiopia
Personal Data Protection Proclamation No. 1321/2024 gives you real rights over your own data: organisations must collect it for a clear purpose, keep it only as long as needed, and let you know what they hold. You have the right to ask what data an organisation holds about you, to correct it, and to object to its processing. These rights apply to you as a student and a citizen, not only to adults in offices.

## Shrinking the footprint
Set profiles to private. Turn off location tagging in your camera and apps. Review connected apps and remove anything you no longer use. Search your own name and username to see what is already public, and clean up what you can. Then try the Digital Footprint Visualiser in the AI Tools section to score your own exposure risk — the answers never leave your device.`,
    contentAm: `## ሁሉም ነገር ዱካ ይተወዋል
የዲጂታል ዱካህ በመስመር ላይ የምታስቀምጠው ነገር ሁሉ ነው፦ ልጥፎች፣ አስተያየቶች፣ መውደዶች፣ የቦታ ምልክት ያላቸው ፎቶዎች፣ የመተግበሪያ ፈቃዶች፣ የድሮ የተጠቃሚ ስሞች። በአሸዋ ላይ ካለ ዱካ በተለየ እነዚህ አይጠፉም — ይቀዱባቸዋል፣ ይመዘገባሉ፣ በኋላ ዓመታት ዩኒቨርሲቲ፣ አሠሪ ወይም ጋዜጠኛ በሚፈልግህ ጊዜ ልክ ተመልሰው ይወጣሉ።

## ሁለት ዓይነት ዱካ
ንቁ ዱካህ በራስህ በምታስቀምጠው ነው። ተንቀሳቃሽ ያልሆነ ዱካህ ሌሎች ስለህ የሚለጥፉትና ሥርዓቶች በጸጥታ የሚሰብሱት ነው፦ ማስታወሻ ያላቸው ፎቶዎች፣ በምስል ውስጥ ያለ የቦታ መረጃ፣ የጓደኛ ዝርዝሮች፣ የመተግበሪያ ትንተናዎች። የመጀመሪያውን በቀጥታ ትቆጣጠራለህ፤ ሁለተኛውን ግን በማስተካከያዎች፣ በግምገማና ጓደኞችን ማስታወሻ እንዲያጠፉ በመጠየቅ ብቻ።

## የዘላቂነት ሕግ
ከመለጠፍህ በፊት ፈትነው፦ የወደፊት አሠሪዬ፣ ቤተሰቤ ወይም እንግዳ ይህን በአምስት ዓመት ውስጥ ሲያነብ ብቻ አስቸግሮኛል? ከሆነ አትለጥፈው። መሰረዝ መሰረዝ አይደለም — ቅጽበታዊ ምስሎችና መዝገቦች ይኖራሉ።

## በኢትዮጵያ ያሉቅ መብቶች
የግል መረጃ ጥበቃ አዋጅ ቁጥር 1321/2024 በራስህ መረጃ ላይ እውነተኛ መብቶችን ይሰጥሃል፦ ድርጅቶች ለግልጽ ዓላማ ብቻ መሰብሰብ፣ ያስፈለገውን ጊዜ ብቻ ማቆየት፣ ምን እንደያዙ ማወቅም ግዴታ ነው። ድርጅት ምን መረጃ እንደያዘብህ መጠየቅ፣ ማስተካከልና አለመስማማት መብት አለህ። እነዚህ መብቶች እንደ ተማሪና እንደ ዜጋ የሚመለከቱህ ናቸው — በቢሮ ላይ ላሉ አዋቂዎች ብቻ አይደለም።

## ዱካውን ማሳነስ
መገለጫዎችን ወደ ግል ቀይር። በካሜራዎና በመተግበሪያዎች ውስጥ የቦታ ምልክትን ዝግ። የተገናኙ መተግበሪያዎችን ገምግምና ያላገለግልከውን አስወግድ። የራስህን ስምና የተጠቃሚ ስም ፈልገህ ምን እንዳለ ይፋዊ ይመልከት፣ የምታስተካክለውንም አስተካክል። ከዚያ በ AI መሳሪያዎች ክፍል ያለውን የዲጂታል ዱካ መታያ ተጠቀም፤ የተጋላጭነትህን ለመመዝን — መልሶችህ ከመሣሪያህ በፍጹም አይወጡም።`,
    questions: [
      {
        promptEn: "You delete an embarrassing post a week after publishing. What is the realistic outcome?",
        promptAm: "ያሳፍረ ልጥፍ ከሰቀልክህ ሳምንት በኋላ ሰርዘሃል። በተግባር የሚከሰተው ምንድን ነው?",
        optionsEn: [
          "It disappears from the internet completely",
          "Screenshots and archives may keep it alive for years",
          "The app emails everyone a copy first",
          "Only your teacher can still see it",
        ],
        optionsAm: [
          "ከኢንተርኔቱ ሙሉ በሙሉ ይጠፋል",
          "ቅጽበታዊ ምስሎችና መዝገቦች ዓመታት ሊያስቆዩት ይችላሉ",
          "መተግበሪያው ለሁሉም ቅጂ ኢሜይል ይልካል",
          "መምህርህ ብቻ አሁንም ማየት ይችላል",
        ],
        answerIdx: 1,
        explainEn: "Deletion removes the original, not the copies. Post as if the delete button does not exist.",
        explainAm: "መሰረዝ መጀመሪያውን ያስወግዳል፣ ቅጂዎቹን አይደለም። የሰርዝ ቁልፍ ከሌለ ሁኖ ያስብና ለጥፍ።",
      },
      {
        promptEn: "Which of these is part of your PASSIVE digital footprint?",
        promptAm: "ከእነዚህ ውስጥ የተንቀሳቃሽ ያልሆነው የዲጂታል ዱካህ አካል የትኛው ነው?",
        optionsEn: [
          "A comment you write",
          "A photo you upload",
          "Location metadata silently stored in your photos",
          "A story you publish",
        ],
        optionsAm: [
          "የምትጽፈው አስተያየት",
          "የምታስቀምጠው ፎቶ",
          "በፎቶዎችህ ውስጥ በጸጥታ የሚመዘገብ የቦታ መረጃ",
          "የምታስቀምጠው ታሪክ",
        ],
        answerIdx: 2,
        explainEn: "Passive footprints are collected without your deliberate action — location metadata, analytics, tags by others. Camera settings can turn them off.",
        explainAm: "ተንቀሳቃሽ ያልሆኑ ዱካዎች ያለ ሆን ተብሎ የሚሰበሱ ናቸው — የቦታ መረጃ፣ ትንተናዎች፣ በሌሎች የሚሰጡ ማስታወሻዎች። የካሜራ ማስተካከያዎች ማጥፋት ይችላሉ።",
      },
      {
        promptEn: "Under Proclamation 1321/2024, what can you ask an organisation that holds your personal data?",
        promptAm: "በአዋጅ 1321/2024 መሠረት የግል መረጃህን ያዘውን ድርጅት ምን መጠየቅ ትችላለህ?",
        optionsEn: [
          "Nothing — companies own your data once collected",
          "What data it holds, and to correct it",
          "Only the data of other people",
          "A daily printed report of everything",
        ],
        optionsAm: [
          "ምንም — ኩባንያዎች አሰብስበው ወዲያውኑ የአንተ ይሆናል",
          "ምን መረጃ እንዳዘው፣ እና ማስተካከልም ማለት",
          "የሌሎች ሰዎችን መረጃ ብቻ",
          "የሁሉም ነገር ዕለታዊ የታተመ ሪፖርት",
        ],
        answerIdx: 1,
        explainEn: "The proclamation grants access, correction and objection rights — your data stays yours even when an organisation processes it.",
        explainAm: "አዋጁ የመጠቀም፣ የማስተካከልና የመቃወም መብቶችን ይሰጣል — ድርጅት ቢያዘውም መረጃህ የአንተ ሆኖ ይቀጥላል።",
      },
    ],
  },
  {
    code: "AW-11",
    sortOrder: 11,
    topic: "social_media_safety",
    audience: "TEENS",
    titleEn: "Social Media: Settings, Strangers, Solidarity",
    titleAm: "ማህበራዊ ሚዲያ፦ ማስተካከያዎች፣ እንግዶች፣ መተሳሰብ",
    summaryEn: "Harden your accounts, recognise fake profiles and catfishing, and stand with targets of online abuse instead of watching.",
    summaryAm: "መለያዎችህን አጥን፣ የሐሰት መገለጫዎችንና ተንኮል አውቅ፣ የመስመር ላይ ብጥብጥ መሳዮችን ከመመልከት ፈንታ አብረህ ቁም።",
    durationMin: 15,
    gradeBand: "9-12",
    contentEn: `## Lock the front door: your settings
Most harm on social media reaches you through open doors: public profiles, everyone-can-message, location tags on. Spend fifteen minutes once: set the profile to friends-only, restrict who can comment and message, turn off location tagging, and stop search engines from indexing your profile. Redo this after every major app redesign — updates often reset options quietly.

## Spotting fake profiles and catfishing
A stolen profile photo, few mutual friends, an account created last month, instant intimacy, and grammar that slips. Reverse-search the profile picture. A person who refuses a one-minute video call after weeks of chatting is not the person in the photos. Catfishing is not always about money — sometimes the goal is images, secrets, or control.

## Group chats and pile-ons
Online conflict in Ethiopian school communities spreads fastest in group chats: a screenshot, an insult, and within an hour a classmate becomes the target of hundreds. Before forwarding an embarrassing screenshot ask: does this need to travel further? The person who forwards is part of the pile-on. The law agrees — coordinated harassment is punishable, and so is spreading someone's private messages or images without consent.

## Being an upstander, not a bystander
If a classmate is being attacked online: do not join, do not like the attacks, and do not stay silent. Message the target privately — "I saw it, it's not okay, I'm with you." Help them document. Report the worst posts. Tell a teacher when it involves your school. Upstanders shrink pile-ons faster than any moderator.

## When it crosses into crime
Direct threats, publishing private images, hate speech targeting an ethnic or religious group, or doxxing someone's address are crimes under Ethiopian law — report them to the platform, and for serious cases to the police and Ethio-CERT.`,
    contentAm: `## በርን ዝጋ፦ ማስተካከያዎችህ
በማህበራዊ ሚዲያ ላይ አብዛኛው ጉዳት በክፍት በሮች ያድርሳል፦ ይፋዊ መገለጫዎች፣ ሁሉም-ሊጽፍ-ይችል፣ የቦታ ምልክት በራታ። አንዴ አሥራ አምስት ደቂቃ አሳልፍ፦ መገለጫውን ለጓደኞች ብቻ አድርግ፣ አስተያየትና መልዕክት የሚጽፉትን ገድል፣ የቦታ ምልክትን ዝግ፣ ፍለጋ ሞተሮች መገለጫህ እንዳያመለጡት አድርግ። ይህን ከእያንዳንዱ ትልቅ የመተግበሪያ ለውጥ በኋላ ደግምም — ዝማኔዎች ማስተካከያዎችን በጸጥታ ይመልሳሉ።

## የሐሰት መገለጫዎችና ተንኮል ማወቅ
የተሰረቀ የመገለጫ ፎቶ፣ ጥቂት የጋራ ጓደኞች፣ ባለፈው ወር የተፈጠረ መለያ፣ ፈጣን ቅርበት፣ የሚደፋፈር ሰፊያ። የመገለጫውን ምስል ወደ ኋላ ፈልገህ ተመልከት። ሳምንታት ከተወያዩ በኋላ አንድ ደቂቃ የቪዲዮ ጥሪ የሚከለክል ሰው በፎቶዎቹ ያለው ሰው አይደለም። ተንኮል ሁሉ ስለ ገንዘብ አይደለም — አንዳንዴ ጓላቂው ምስሎች፣ ሚስጥሮች ወይም ቁጥጥር ነው።

## የቡድን ውይይቶችና የተቃውሞ ማሸግ
በኢትዮጵያ የትምህርት ቤት ማህበረሰቦች ውስጥ የመስመር ላይ ግጭት በቡድን ውይይቶች በፍጥነት ይሰራጫል፦ አንድ ቅጽበታዊ ምስል፣ አንድ ስድብ፣ በአንድ ሰዓት ውስጥ የክፍል ተማሪ የበርካታ ሰዎች ጥቃት ዓላማ ይሆናል። ያሳፍረ ቅጽበታዊ ምስል ከመላክህ በፊት ጠይቅ፦ ይህ ወደ ሌላ ቦታ መጓዝ አለበት? የሚያስተላልፈው ሰው የማሸግው አካል ነው። ሕጉም እንደሚስማማ — የተታጀደ ማሳደድ ተጠያቂ ነው፤ ያለ ፈቃድ የሰውን የግል መልዕክት ወይም ምስል ማሰራጨትም እንዲሁ።

## መመልከቻ ሳይሆን አብሮ መቆም
የክፍል ተማሪ በመስመር ላይ ቢደለደል፦ አትተባበል፣ ጥቃቶቹን አትወደድ፣ ጸጥ ብለህም አትቀመጥ። ለተጎዳው በግል መልዕክት ላክ — "አየሁት፣ ትክክል አይደለም፣ ከአንተ ጋር ነኝ።" ማስረጃ እንዲያዝ ይርዳው። ክፉ ልጥፎችን ሪፖርት አድርግ። ትምህርት ቤትህን የሚመለከት ከሆነ ለመምህር ንገር። አብረው የሚቆሙ ወጣቶች ከማንኛውም መቆጣጠሪያ በፍጥነት ማሸግን ያሳንሳሉ።

## ወደ ወንጀል የሚሸጋገርበት ጊዜ
ቀጥተኛ ማስፈራራት፣ የግል ምስል ማስፋፋት፣ ብሔር ወይም ሃይማኖት ቡድንን የሚመኘ ጥላት ንግግር፣ ወይም የሰው አድራሻ ማውጣት በኢትዮጵያ ሕግ ሥር ወንጀል ናቸው — ለመድረኩ ሪፖርት አድርግ፣ ከባድ ጉዳዮችን ለፖሊስና ለኢትዮ-ሴርትም።`,
    questions: [
      {
        promptEn: "Which behaviour belongs to an UPSTANDER during a pile-on against a classmate?",
        promptAm: "በክፍል ተማሪ ላይ በሚደረግ ማሸግ ወቅት የአብሮ መቆሚያ ምሉዕ የትኛው ነው?",
        optionsEn: [
          "Liking the funny insults to fit in",
          "Staying silent so nobody notices you",
          "Messaging the target support and reporting the worst posts",
          "Forwarding the screenshots to another group",
        ],
        optionsAm: [
          "ለመመሳሰል አስቂዎቹን ስድቦች መውደድ",
          "ማንም እንዳያስተውለህ ጸጥ ብለህ መቀመጥ",
          "ለተጎዳው ድጋፍ መልዕክት መላክና ክፉ ልጥፎችን ሪፖርት ማድረግ",
          "ቅጽበታዊ ምስሎቹን ወደ ሌላ ቡድን ማስተላለፍ",
        ],
        answerIdx: 2,
        explainEn: "Support in private, report in public channels — upstanders cut pile-ons short while likers and forwarders extend them.",
        explainAm: "በግል ድጋፍ አድርግ፣ ደህና በሆነ መንገድ ሪፖርት አድርግ — አብሮ የሚቆሙ ማሸግን ያሳጥራሉ፤ የሚወዱትና የሚያስተላልፉት ግን ያራዝሙታል።",
      },
      {
        promptEn: "Three weeks of chatting, but the person always refuses a short video call. Most likely explanation?",
        promptAm: "ሦስት ሳምንት ውይይት ተደርጓል፣ ግን ሰውየው አጭር የቪዲዮ ጥሪ ሁልጊዜ ይከለካል። በአብዛኛው የሚተረጎመው ምንድን ነው?",
        optionsEn: [
          "Shyness — keep chatting for months",
          "The profile is probably not the real person (catfishing)",
          "Bad network in their city",
          "They lost their camera",
        ],
        optionsAm: [
          "ውርደት — ወራት ውይይትን ቀጥል",
          "መገለጫው ምናልባት እውነተኛው ሰው አይደለም (ተንኮል)",
          "በከተማው የኔትወርኩ ደካማ ነው",
          "ካሜራውን አጥቷል",
        ],
        answerIdx: 1,
        explainEn: "Weeks of text with a hard refusal of one live minute is the classic catfishing signature — verify before trusting.",
        explainAm: "የሳምንታት ጽሑፍ ውይይት ከአንድ ቀጥታ ደቂቃ ጋር ንጹህ አለመስማማት — የተንኮል የተለመደ ምልክት ነው። ከመተማመንህ በፊት አረጋግጥ።",
      },
      {
        promptEn: "Why re-check your privacy settings after every major app update?",
        promptAm: "ከእያንዳንዱ ትልቅ የመተግበሪያ ዝማኔ በኋላ የግላዊነት ማስተካከያዎችህን ለምን ደግሞ ታረጋግጣለህ?",
        optionsEn: [
          "Updates often reset options to less private defaults",
          "Settings expire after 30 days",
          "Your friends can change them",
          "There is no reason",
        ],
        optionsAm: [
          "ዝማኔዎች ብዙ ጊዜ አማራጮችን ወደ ያነሰ የግል ነባሪ ይመልሳሉ",
          "ማስተካከያዎች ከ30 ቀናት በኋላ ያበቃሉ",
          "ጓደኞችህ መቀየር ይችላሉ",
          "ምንም ምክንያት የለውም",
        ],
        answerIdx: 0,
        explainEn: "Redesigns routinely restore defaults — public profile, discoverable by search. A five-minute recheck keeps your locks closed.",
        explainAm: "እንደገና ማዋቀር ብዙ ጊዜ ነባሪዎችን ይመልሳል — ይፋዊ መገለጫ፣ በፍለጋ የሚገኝ። አምስት ደቂቃ ዳግም መመልከት ቁልፎችህን ዝግ ያደርጋቸዋል።",
      },
    ],
  },
];

export const AWARENESS_MODULES_PRO: ModuleSeed[] = [
  {
    code: "AW-12",
    sortOrder: 12,
    topic: "log_analysis",
    audience: "PRO",
    titleEn: "Think Like an Analyst: Reading Logs",
    titleAm: "እንደ ተንታኝ አስብ፦ ምዝገባዎችን ማንበብ",
    summaryEn: "University-level unit: how analysts spot brute force, impossible travel and privilege abuse in authentication logs — with a lab exercise.",
    summaryAm: "የዩኒቨርሲቲ ደረጃ ክፍል፦ ተንታኞች የማረጋገጫ ምዝገባዎች ውስጥ ጉልበተኛ ጥረትን፣ የማይቻል ጉዞንና የቅደም ተከተል አመራረንን እንዴት እንደሚያዩ — ከላብ ልምምድ ጋር።",
    durationMin: 25,
    gradeBand: "university",
    contentEn: `## Why logs are the analyst's raw material
When an incident happens, memory lies and witnesses forget — but logs record. Every authentication, every file access, every privilege change leaves a line with a timestamp. Analysts who read logs well reconstruct what happened, when, and from where; the rest of security response depends on that reconstruction.

## The signatures you should recognise

**Brute force and password spraying.** Many failed logins for one account = brute force. One or two failures each across many accounts = password spraying — smarter, because it evades simple lockouts. Look for: failure bursts, one IP testing many usernames, or success immediately after a long failure run.

**Impossible travel.** A login from Addis Ababa at 09:00 and from another continent at 09:20 means one of the two is a lie — usually a stolen session token or credentials. Modern platforms flag velocity: distance ÷ time between authentications.

**Off-hours privilege use.** An administrator account active at 03:00 on a public holiday, or a service account suddenly logging in interactively, deserves a second look. Attackers use legitimate privileges; the timeline gives them away.

**New device, new location, then a rule change.** The classic takeover chain: new device → MFA prompt fatigue → conditional-access rule modified. Single events look innocent; the sequence does not.

## Lab: read these ten lines
The fastest way to learn is to read. This platform's SOC module generates such traces for bank tenants; on the awareness portal, the Phishing Radar and reporting tools complement this unit. Find any authentication log (a VPN, SSH, or web app), and practise asking three questions of every line: is this identity expected here, at this time, from this place?

## Care and ethics
Log reading is powerful and therefore sensitive: it reveals what real people did. Handle personal data in logs under the same Proclamation 1321/2024 principles as any other data — purpose, minimisation, access control. An analyst protects people, not just machines.`,
    contentAm: `## ምዝገባዎች ለምን የተንታኝ ጥሬ ዕቃ ናቸው
አደጋ ሲከሰት ትውስታ ይወፍራል፣ ምስክሮችም ይረሳሉ — ምዝገባዎች ግን ይመዘግባሉ። እያንዳንዱ ማረጋገጫ፣ እያንዳንዱ የፋይል መዳረሻ፣ እያንዳንዱ የቅደም ተከተል ለውጥ ከጊዜ አቻ ጋር መስመር ይተወዋል። ምዝገባዎችን በደንብ የሚያነቡ ተንታኞች ምን መቼ ከየት እንደተከሰተ ይቆምቃሉ፤ የደህንነት ምላሹ ሁሉ በዚያ ግንባታ ላይ ይቆማል።

## የሚያውቋቸው ፊርማዎች

**ጉልበተኛ ጥረትና የይለፍ ቃል መርጫ ማረጋገጥ።** ለአንድ መለያ ብዙ ያልተሳኩ ማግቢያዎች = ጉልበተኛ ጥረት። በብዙ መለያዎች ላይ አንድ ወይም ሁለት ውድቀቶች = የይለፍ ቃል መርጫ ማረጋገጥ — ብልህ ነው፣ ቀላል መታገድን ስለሚያሻሽል። ይመልከቱ፦ የውድቀት ጉድለት፣ አንድ IP ብዙ የተጠቃሚ ስሞችን መፈተሽ፣ ወይም ከረጅም ውድቀት በኋላ ወዲያውኑ ስኬት።

**የማይቻል ጉዞ።** ጥላ 09:00 ከአዲስ አበባ እና 09:20 ከሌላ አህጉር የመግቢያ ማለት አንዱ ውሸት ነው — ብዙ ጊዜ የተሰረቀ የክፍለ-ጊዜ ቁራጭ ወይም ማንነት። ዘመናዊ መድረኮች ፍጥነትን ያመለክታሉ፦ ርቀት ÷ ጊዜ በማረጋገጫዎች መካከል።

**ከሰዓት ውጭ የቅደም ተከተል አጠቃቀም።** በ03:00 በሕዝባዊ በዓል በሚሠራ የአስተዳደር መለያ፣ ወይም በድንገት በቀጥታ የሚገባ የአገልግሎት መለያ ሁለተኛ እይታ ይገባዋል። ጠላቆች ወጥ የቅደም ተከተል መብቶችን ይጠቀማሉ፤ የጊዜ መስመሩ ያጋልጣቸዋል።

**አዲስ መሣሪያ፣ አዲስ ቦታ፣ ከዚያ የደንብ ለውጥ።** የተለመደው የመውረድ ሰንሰለት፦ አዲስ መሣሪያ → የMFA ዕረፍት ጫና → የመድረስ ደንብ ማሻሻያ። ነጠላ ክስተቶች ተራ ይመስላሉ፤ ቅደም ተከተሉ ግን አይደለም።

## ላብ፦ እነዚህን አሥር መስመሮች አንብብ
መማር የሚጀምረው በማንበብ ነው። የዚህ መድረክ SOC ክፍል ለባንክ ተከራይ ድርጅቶች እንዲህ ያሉ አሻራዎችን ይፈጥራል፤ በግንዛቤ በርታሉም የፊሺንግ ራዳርና የሪፖርት መሳሪያዎች ይህን ክፍል ያሟላሉ። ማንኛውንም የማረጋገጫ ምዝገባ ውሰድ (VPN፣ SSH ወይም የድር መተግበሪያ)፣ ለእያንዳንዱ መስመር ሦስት ጥያቄዎችን ለመጠየቅ ተለማመድ፦ ይህ ማንነት እዚህ ተጠብቆ ነው፣ በዚህ ሰዓት፣ ከዚህ ቦታ?

## ጥንቃቄና ሞራል
ምዝገባ ማንበብ ኃይለኛ በመሆኑ ስሜታዊ ነው፦ በውስጡ እውነተኛ ሰዎች ምን እንዳደረጉ ይገልጣል። በምዝገባዎች ውስጥ ያለን የግል መረጃ እንደ ማንኛውም መረጃ በአዋጅ 1321/2024 መርሆች ሥር ያስተናግዱ — ዓላማ፣ ማነስ፣ የመዳረሻ ቁጥጥር። ተንታኝ ማሽኖችን ብቻ ሳይሆን ሰዎችን ይጠብቃል።`,
    questions: [
      {
        promptEn: "One failed login on each of 4,000 accounts from the same IP. What is this?",
        promptAm: "ከተመሳሳይ IP በ4,000 መለያዎች ላይ በእያንዳንዱ አንድ ያልተሳካ የመግቢያ ሙከራ። ይህ ምንድን ነው?",
        optionsEn: [
          "Random user typos",
          "Password spraying",
          "A backup job",
          "Password reset storm",
        ],
        optionsAm: [
          "በነሱ የሚታዩ የስህተት ጽሑፎች",
          "የይለፍ ቃል መርጫ ማረጋገጥ",
          "የመጠባበቂያ ሥራ",
          "የይለፍ ቃል መቀየር ማውዛት",
        ],
        answerIdx: 1,
        explainEn: "One try per account across thousands of accounts is spraying: it evades per-account lockouts, so detect it per-source, not per-account.",
        explainAm: "በበርካታ መለያዎች ላይ አንድ ሙከራ መርጫ ማረጋገጥ ነው፦ በመለያ መታገድን ያሻሽላል፤ ስለዚህ በመለያ ሳይሆን በምንጭ አስተውሉት።",
      },
      {
        promptEn: "Login from Addis Ababa 09:00, then from Nairobi 09:15 — same account, valid password both times. Best interpretation?",
        promptAm: "ጥላ 09:00 ከአዲስ አበባ የመግቢያ፣ ከዚያ 09:15 ከናይሮቢ — ተመሳሳይ መለያ፣ ሁለቱም ትክክለኛ የይለፍ ቃል። ምርጡ ትርጓሜ የትኛው ነው?",
        optionsEn: [
          "The user took a fast plane",
          "Impossible travel — suspect stolen credentials or session token",
          "Timezone bug in the log",
          "Normal parallel login",
        ],
        optionsAm: [
          "ተጠቃሚው ፈጣን አውሮፕላን ወሰደ",
          "የማይቻል ጉዞ — የተሰረቀ ማንነት ወይም የክፍለ-ጊዜ ቁራጭ ተጠርጣሪ ነው",
          "በምዝገባው ውስጥ የጊዜ ክልል ስህተት",
          "የተለመደ ትይዩ መግቢያ",
        ],
        answerIdx: 1,
        explainEn: "Velocity between the two points exceeds any flight — treat as takeover: revoke sessions, reset credentials, investigate the second login.",
        explainAm: "በሁለቱ ነጥቦች መካከል ያለው ፍጥነት ከማንኛውም በረራ ይበልጣል — እንደ መውረድ ይቆጥሩ፦ ክፍለ-ጊዜዎችን አስወግድ፣ ማንነቶችን ዳግም አስጀምር፣ ሁለተኛውን መግቢያ መርምር።",
      },
      {
        promptEn: "You must read logs containing colleagues' personal activity. What governs how you handle them?",
        promptAm: "የጓደኞችህ የግል እንቅስቃሴ ያላቸውን ምዝገባዎች ማንበብ አለብህ። እንዴት ማስተናገድህን የሚመራው ምንድን ነው?",
        optionsEn: [
          "Nothing — analysts have full access",
          "Proclamation 1321/2024 principles: purpose, minimisation, access control",
          "Only your manager's mood",
          "Whoever owns the server decides",
        ],
        optionsAm: [
          "ምንም — ተንታኞች ሙሉ መዳረሻ አላቸው",
          "የአዋጅ 1321/2024 መርሆች፦ ዓላማ፣ ማነስ፣ የመዳረሻ ቁጥጥር",
          "የሱፐርቫይዘርህ ስሜት ብቻ",
          "ሰርቨሩ የሚያሸንፈው ወስኖ ያደርገዋል",
        ],
        answerIdx: 1,
        explainEn: "Logs are personal data. The same proclamation applies: collect and read only for the stated purpose, keep access tight, delete when the purpose ends.",
        explainAm: "ምዝገባዎች የግል መረጃ ናቸው። ተመሳሳይ አዋጅ ይመለምላል፦ ለተገለጸው ዓላማ ብቻ ሰብስብና አንብብ፣ መዳረሻውን ጠብቅ፣ ዓላማው ሲያበቃ ሰርዝ።",
      },
    ],
  },
  {
    code: "AW-13",
    sortOrder: 13,
    topic: "incident_handling",
    audience: "PRO",
    titleEn: "Incident Handling: The First Hour",
    titleAm: "የአደጋ ማስተናገድ፦ የመጀመሪያው ሰዓት",
    summaryEn: "A student-friendly walk through the NIST incident-response lifecycle, what matters in the first hour, and how Ethio-CERT fits in.",
    summaryAm: "የNIST የአደጋ ምላሽ ዑደትን የሚያሻግር ለተማሪ ቀላል ጉዞ፣ በመጀመሪያው ሰዓት ውስጥ ምን እንደሚገባ፣ እና ኢትዮ-ሴርት የት እንደሚገባ።",
    durationMin: 25,
    gradeBand: "university",
    contentEn: `## The lifecycle, not the firefight
NIST SP 800-61 frames incident response as a loop, not a sprint: Preparation → Detection & Analysis → Containment → Eradication → Recovery → Lessons Learned. University clubs, campus IT teams and start-ups that internalise the loop survive incidents; those that improvise repeat them.

## The first hour decides the year
When an alert fires, three actions matter before anything else. **Confirm scope**: which accounts, hosts and data are touched — an incident's size is usually misjudged in both directions. **Contain without destroying**: isolate the machine from the network, but do not power it off — RAM holds evidence that dies with the power button. **Tell the right people**: your supervisor, security contact, and for serious cases Ethio-CERT. Silence is the most expensive mistake.

## Containment trade-offs
Pulling the cable stops the bleeding but tips off the attacker; monitoring quietly preserves intelligence while the risk grows. There is no universal answer — there is a decision that should be written down, with a time and a name next to it. That note is what you will defend in the post-mortem.

## Evidence: cheap now, priceless later
Every action after detection is evidence: log exports, screenshots, commands typed and their output, timeline notes. Record timestamps with timezone. Hash important artefacts. In Ethiopia, evidence from a cyber incident supports police cases under the Computer Crime Proclamation framework, so sloppy handling can sink a prosecution.

## Escalation to the national level
Ethio-CERT, operating under INSA, is Ethiopia's national incident coordination point. Banks and critical institutions have reporting duties under NBE directives; universities and private organisations benefit from reporting early — coordination, advisories and threat intelligence flow back. This awareness platform's own SOC module demonstrates the same lifecycle for its bank tenants, and the Cybercrime Reporting Guide in the AI Tools section walks anyone through reporting channels.

## After the dust: lessons learned
The post-incident meeting is not blame theatre. Two questions: how did it get in, and what made detection slow? Every answer becomes a control, a rule, or a training unit — exactly how this curriculum itself grows.`,
    contentAm: `## እሳት ማጥፋት ሳይሆን ዑደት
NIST SP 800-61 የአደጋ ምላሽን እንደ ጉዞ ሳይሆን እንደ ዑደት ያቀርባል፦ ዝግጅት → ማግኘትና መተንተን → ማገጃ → ማጽዳት → መልሶ ማቋቋም → ትምህርት ውሰድ። ዑደቱን የተረዱ የዩኒቨርሲቲ ክለቦች፣ የካምፓስ የአይቲ ቡድኖችና ስታርት-አፖች አደጋዎችን ያልፋሉ፤ በማሻሻያ የሚሠሩት ግን ደግሞ ይደጋግማሉ።

## የመጀመሪያው ሰዓት ዓመቱን ይወስናል
ማንቂያ ሲያወጣ ከሁሉም በፊት ሦስት ተግባራት ይገባሉ። **የመጠኑን አረጋግጥ**፦ የትኞቹ መለያዎች፣ ኮምፒውተሮችና መረጃዎች ይነካሉ — የአደጋው መጠን በሁለቱም አቅጣጫ ብዙ ጊዜ በስህተት ይገመታል። **ሳታጠፋ አግልል**፦ ማሽኑን ከኔትወርኩ ልይ፣ ግን አብራው አብቀይ — በRAM ውስጥ ያለ ማስረጃ ከኃይል ቁልፍ ጋር ይሞታል። **ትክክለኛዎቹን ሰዎች አሳውቅ**፦ ሱፐርቫይዘርህን፣ የደህንነት እውቂያህን፣ ከባድ ጉዳዮችም ኢትዮ-ሴርትን። ጸጥታ ከሁሉ ውድ ስህተት ነው።

## የማገጃ ሚዛኖች
ገመዱን መሳብ ደም መፍሰሱን ያቆማል ግን ጠላቱን ያስገነዘባል፤ በጸጥታ መከታተል ብልህነትን ይጠብቃል ስጋቱ ግን ያድጋል። ሁለንተናዊ መልስ የለም — የሚኖረው ጊዜና ስም ያለው ጽሑፍ የተመዘገበ ውሳኔ ነው። ያ ማስታወሻ በኋለኛው ግምገማ የምታስከትለው ነው።

## ማስረጃ፦ አሁን ርካሽ፣ በኋላ የማይተማመን ዋጋ
ከማግኘቱ በኋላ የሚደረገው እያንዳንዱ ተግባር ማስረጃ ነው፦ የምዝገባ ወጪዎች፣ ቅጽበታዊ ምስሎች፣ የተጻፉ ትዕዛዞችና ውጤታቸው፣ የጊዜ መስመር ማስታወሻዎች። ከጊዜ ክልል ጋር የጊዜ ማታለቂያዎችን መዝግብ። አስፈላጊ አርቴፋክቶችን ሂሽ አድርግ። በኢትዮጵያ የሳይበር አደጋ ማስረጃ የኮምፒውተር ወንጀል አዋጅ ማዕቀፍ ሥር የፖሊስ ጉዳዮችን ይደግፋል፤ የተሳሳተ ማስተናገድ ክስተትን ሊያስጠፋ ይችላል።

## ወደ ብሔራዊ ደረጃ ማሳደግ
በኢንሳ ሥር የሚሠራ ኢትዮ-ሴርት የኢትዮጵያ ብሔራዊ የአደጋ ማስተባበሪያ ነጥብ ነው። ባንኮችና ወሳኝ ተቋማት በNBE መመሪያዎች ሥር የሪፖርት ግዴታ አላቸው፤ ዩኒቨርሲቲዎችና የግል ድርጅቶች ቀድመው በመሪፖርት ይጠቀማሉ — ማስተባበር፣ ማስጠንቀቂያዎችና የስጋት ብልህነት ተመልሰው ይፈስሳሉ። የዚህ በርታል SOC ክፍል ለባንክ ተከራይ ድርጅቶች ተመሳሳይ ዑደትን ያሳያል፤ በAI መሳሪያዎች ክፍል ያለው የሳይበር ወንጀል ሪፖርት መመሪያም ለሁሉም ሰው ቻናሎቹን ያሻግራል።

## ከአቧራ በኋላ፦ የተማርነው
ከአደጋው በኋላ የሚደረገው ስብሰባ የውርደት ትርክ አይደለም። ሁለት ጥያቄዎች፦ እንዴት ገባ? ምን ማግኘቱን አዘገየ? እያንዳንዱ መልስ ቁጥጥር፣ ደንብ ወይም የልምምድ ክፍል ይሆናል — ይህ ራሱ ይህ ምህረት እንዴት እንደሚያድግ ትርጉም ነው።`,
    questions: [
      {
        promptEn: "A compromised laptop is found. First responder action that PRESERVES evidence?",
        promptAm: "የተወረደ ላፕቶፕ ተገኝቷል። ማስረጃውን የሚጠብቅ የመጀመሪያ ምላሽ የትኛው ነው?",
        optionsEn: [
          "Power it off immediately",
          "Disconnect from network but leave it running",
          "Reinstall Windows right away",
          "Hand it to the intern to explore",
        ],
        optionsAm: [
          "ወዲያውኑ አጥፋው",
          "ከኔትወርክ አግልለህ በራቶ ተውው",
          "ወዲያውኑ Windows ደግሞ ተክለው",
          "ለኢንተርኑ ሰጥተህ ይገምግም",
        ],
        answerIdx: 1,
        explainEn: "Isolation stops the attacker; keeping it running preserves volatile memory evidence that shutdown destroys.",
        explainAm: "መከላከያ ጠላቱን ያቆማል፤ በራቶ መተወት የመዝጋት እርምጃ የሚያጠፋውን ተንቀሳቃሽ የማስተውስ ማስረጃ ይጠብቃል።",
      },
      {
        promptEn: "What is the correct order of the NIST SP 800-61 lifecycle?",
        promptAm: "የNIST SP 800-61 ዑደት ትክክለኛ ቅደም ተከተል የትኛው ነው?",
        optionsEn: [
          "Recovery → Detection → Preparation",
          "Preparation → Detection & Analysis → Containment → Eradication → Recovery → Lessons",
          "Eradication → Containment → Detection",
          "Lessons → Containment → Preparation",
        ],
        optionsAm: [
          "መልሶ ማቋቋም → ማግኘት → ዝግጅት",
          "ዝግጅት → ማግኘትና መተንተን → ማገጃ → ማጽዳት → መልሶ ማቋቋም → ትምህርት",
          "ማጽዳት → ማገጃ → ማግኘት",
          "ትምህርት → ማገጃ → ዝግጅት",
        ],
        answerIdx: 1,
        explainEn: "Preparation first, lessons last — and then the loop feeds preparation of the next cycle.",
        explainAm: "ዝግጅት መጀመሪያ፣ ትምህርት መጨረሻ — ከዚያ ዑደቱ የቀጣዩ ዑደት ዝግጅትን ያለማቋረጥ ይመጣል።",
      },
      {
        promptEn: "For a serious national-scale incident, who is Ethiopia's coordination point?",
        promptAm: "ለከባድ በብሔር ደረጃ የሚሠራ አደጋ የኢትዮጵያ ማስተባበሪያ ነጥብ ማን ነው?",
        optionsEn: [
          "The ISP's helpdesk",
          "Ethio-CERT, operating under INSA",
          "The university registrar",
          "Any private SOC",
        ],
        optionsAm: [
          "የኢንተርኔት አቅራቢው የድጋፍ ጠረጴዛ",
          "በኢንሳ ሥር የሚሠራ ኢትዮ-ሴርት",
          "የዩኒቨርሲቲው መመዝገቢያ",
          "ማንኛውም የግል SOC",
        ],
        answerIdx: 1,
        explainEn: "Ethio-CERT under INSA coordinates national incidents and exchanges advisories and intelligence — early reporting flows both ways.",
        explainAm: "በኢንሳ ሥር ያለ ኢትዮ-ሴርት ብሔራዊ አደጋዎችን ያስተባብራል፣ ማስጠንቀቂያዎችንና ብልህነትን ይለዋውጣል — ቀድመህ ማሪፖርት ወደ ሁለቱም አቅጣጫ ይፈሳል።",
      },
    ],
  },
];

export const AWARENESS_MODULES_AWARE: ModuleSeed[] = [
  {
    code: "AW-14",
    sortOrder: 14,
    topic: "bec_staff",
    audience: "AWARE",
    titleEn: "Phishing and Payment Fraud at Work",
    titleAm: "በሥራ ላይ ፊሺንግና የክፍያ ማታለል",
    summaryEn: "For SME and government staff: business email compromise, CEO fraud and telebirr-transfer scams — and the verification habits that stop them.",
    summaryAm: "ለግል ድርጅትና ለመንግሥት ሠራተኞች፦ የቢዝነስ ኢሜይል ብክለት፣ የCEO ማታለልና የቴሌብር ዝውው ማታላት — እና የሚያቆሟቸው የማረጋገጫ ልማዶች።",
    durationMin: 20,
    gradeBand: "adult",
    contentEn: `## Your inbox is the front line
For most Ethiopian organisations, the first attack is not a hacker in a basement — it is an email, SMS or chat message that looks routine. Staff who handle invoices, HR records or payments are the real perimeter, and attackers study them before writing to them.

## Business email compromise (BEC)
The attacker does not need malware. They study your organisation's structure from your website, then send payment instructions that look internal: "I am in a meeting, please urgently pay this supplier — here are new bank details." Sometimes they have already compromised a real mailbox and reply inside an existing thread, so everything looks normal. The email itself is clean; only the bank account is new.

## The Ethiopian patterns
The awareness corpus for this platform documents the recurring shapes: CBE and Dashen lookalike domains asking staff to "verify" accounts; telebirr refund lures; HR emails collecting bank details for a "new salary system"; Ethio Telecom disconnection threats; fake tender portals. Birr amounts are chosen small enough to skip approval, big enough to matter.

## Verification culture beats cleverness
The defence is boring and unbeatable: any change to payment details, any out-of-band urgency, any request touching money or credentials is verified through a second, known channel. Call the number you already have — never the number in the email. Two people approve. A delay of ten minutes has never bankrupted anyone; a failed verification has saved many.

## OTP and credentials are never shared
No bank, no telecom, no IT team will ever ask for your OTP, PIN or password. Requests for "verification codes" are theft in progress. Report them to your security contact and to the bank immediately.

## If money moved
Call the bank and telebirr (994) at once, preserve everything — the email with full headers, the transfer reference — and report to your manager, the police, and for bank tenants the incident flows to Ethio-CERT through the SOC channel. Speed decides recoverability.`,
    contentAm: `## ኢንቦክስህ የግንባር ቀደም መስመር ነው
ለአብዛኛዎቹ የኢትዮጵያ ድርጅቶች የመጀመሪያው ጥቃት ባስመንት ያለ ሃኪም አይደለም — የተለመደ የሚመስል ኢሜይል፣ ኤስኤምኤስ ወይም ውይይት ነው። ደረሰኞችን፣ የሰው ሀብት ምዝገባዎችን ወይም ክፍያዎችን የሚያስተናግዱ ሠራተኞች እውነተኛው ድንበር ናቸው፤ ጠላቶችም ከመጻፍላቸው በፊት ያጠናሉ።

## የቢዝነስ ኢሜይል ብክለት (BEC)
ጠላቱ ማልዌር አያስፈልገውም። ከድርጅትህ ድረ-ገጽ መዋቅርህን ያጠናሉ፣ ከዚያ ውስጣዊ የሚመስሉ የክፍያ መመሪያዎችን ይልካሉ፦ "በስብሰባ ላይ ነኝ፣ እባክህ ይህን አቅራቢ በቅጽበት ክፈልልኝ — አዲስ የባንክ ዝርዝሮች እነዚህ ናቸው።" አንዳንዴ እውነተኛ ኢሜይል ማስታወሻ ቀድመው ወርደው፣ በነበረ ውይይት ውስጥ ይመልሳሉ — ሁሉም መደበኛ ይመስላል። ኢሜይሉ ራሱ ንጹህ ነው፤ አዲሱ የባንክ ሂሳብ ብቻ ነው።

## የኢትዮጵያ ንድፎች
የዚህ መድረክ የግንዛቤ ማህደር የተደጋገሙትን ቅርጾች ይመዘግባል፦ ሠራተኞችን እንዲ"ያረጋግጡ" የሚጋብዙ የCBEና የDashen ማስመሰያ ገጽታዎች፤ የቴሌብር ገንዘብ መመለስ ገሚሾች፤ ለ"አዲስ የደመያ ሥርዓት" የባንክ ዝርዝር የሚሰብስቡ የሰው ሀብት ኢሜይሎች፤ የኢትዮ ቴሌኮም የመቁረጥ ማስፈራራት፤ ሐሰተኛ የጨረታ በሮች። የብር መጠኖቹ ማጽደቅ የማያስፈልጋቸው ትንሽ፣ ጉዳቱ ግን አስፈጻሚ የሚሆኑ ተመርጠዋል።

## የማረጋገጫ ባህል ብልህነትን ይበልጣል
መከላከያው ማራኪ አይደለም ግን የማይሸነፍ ነው፦ ማንኛውም የክፍያ ዝርዝር ለውጥ፣ ማንኛውም ያለ ቻናል ፍጥነት ጫና፣ ገንዘብን ወይም ማንነትን የሚነኩ ጥያቄዎች በሁለተኛ የታወቀ ቻናል ይረጋገጣሉ። ቀድሞ ወዳለው ቁጥር ደውል — በኢሜይሉ ውስጥ ራሱ የሚገኘውን ቁጥር በጭራሽ አይደለም። ሁለት ሰው ያጸድቁ። የአሥር ደቂቃ መዘግየት አንድን ሰው ያበደው የለም፤ የተሳካ ማረጋገጥ ግን ብዙዎችን አድኗል።

## OTPና ማንነቶች በጭራሽ አይጋራም
ማንኛውም ባንክ፣ ቴሌኮም ወይም የአይቲ ቡድን ማረጋገጫ ኮድህን፣ PINህን ወይም የይለፍ ቃልህን አይጠይቅም። "የማረጋገጫ ኮድ" ጥያቄዎች በሂደት ላይ ያለ ስርቆት ናቸው። ለደህንነት እውቂያህና ለባንኩ ወዲያውኑ ሪፖርት አድርጋቸው።

## ገንዘብ ከመራበት
ባንኩንና ቴሌብርን (994) ወዲያውኑ ደውል፣ ሁሉንም ነገር ጠብቅ — ሙሉ ራስጌ ያለው ኢሜይሉን፣ የዝውው ማጣቀሻውን — ለሱፐርቫይዘርህ፣ ለፖሊስ ሪፖርት አድርግ፤ ለባንክ ተከራይ ድርጅቶችም ጉዳዩ በSOC ቻናል ወደ ኢትዮ-ሴርት ይፈስሳል። ተመልሶ ሊለጠፍ የሚችለውን ፍጥነትህ ይወስናል።`,
    questions: [
      {
        promptEn: "An email from your director asks you to urgently pay a supplier using new bank details. Correct first step?",
        promptAm: "ከዳይሬክተርህ የመጣ ኢሜይል አዲስ የባንክ ዝርዝር በመጠቀም አቅራቢን በቅጽበት እንድታገዙ ይጠይቃል። ትክክለኛው የመጀመሪያ እርምጃ ምንድን ነው?",
        optionsEn: [
          "Pay fast — it is the director",
          "Verify by calling the director on the number you already have",
          "Reply to the email to confirm",
          "Pay half now, half later",
        ],
        optionsAm: [
          "በፍጥነት ክፈል — ዳይሬክተር ነውና",
          "ቀድሞ ባለህ ቁጥር ስልክ በማድረግ አረጋግጥ",
          "ለማረጋገጥ ለኢሜይሉ መልስ ስጥ",
          "ግማሽኑን አሁን፣ ግማሽኑን በኋላ",
        ],
        answerIdx: 1,
        explainEn: "Urgency + new payment details = verify out-of-band on a known channel. Replying to the email reaches the attacker, not the director.",
        explainAm: "ፍጥነት + አዲስ የክፍያ ዝርዝር = በታወቀ ቻናል ውጪ አረጋግጥ። ለኢሜይሉ መመለስ ወደ ዳይሬክተር ሳይሆን ወደ ጠላቱ ይደርሳል።",
      },
      {
        promptEn: "Someone claiming to be from telebirr asks for the OTP just sent to your phone. What is this?",
        promptAm: "ከቴሌብር የመጣ ስለሚል ሰው አሁን ወደ ስልክህ የተላከውን የማረጋገጫ ኮድ (OTP) ይጠይቅሃል። ይህ ምንድን ነው?",
        optionsEn: [
          "Routine wallet maintenance",
          "Theft in progress — no real service ever asks for your OTP",
          "A telecom system test",
          "A new government registration",
        ],
        optionsAm: [
          "የተለመደ የዋሌት ጥገና",
          "በሂደት ላይ ያለ ስርቆት — እውነተኛ አገልግሎት በጭራሽ OTPህን አይጠይቅም",
          "የቴሌኮም ሥርዓት ሙከራ",
          "አዲስ የመንግሥት ምዝገባ",
        ],
        answerIdx: 1,
        explainEn: "OTP requests are always an attacker converting a stolen password into a stolen wallet. Hang up, change the password, report to 994.",
        explainAm: "የOTP ጥያቄ ሁሉ የተሰረቀ የይለፍ ቃልን ወደ የተሰረቀ ዋሌት የሚቀይር ጠላት ነው። ስልኩን ዝጋ፣ የይለፍ ቃሉን ቀይር፣ በ994 ሪፖርት አድርግ።",
      },
      {
        promptEn: "Which habit most reliably stops BEC losses across an organisation?",
        promptAm: "በድርጅት ውስጥ የBEC ኪሳራን በታማኝነት የሚያቆም ልማድ የትኛው ነው?",
        optionsEn: [
          "Faster email reading",
          "Second-channel verification + dual approval for payment changes",
          "Trusting internal domains blindly",
          "Paying quickly to avoid delays",
        ],
        optionsAm: [
          "በፍጥነት ኢሜይል ማንበብ",
          "የሁለተኛ ቻናል ማረጋገጥ + ለክፍያ ለውጦች ጥምር ማጽደቅ",
          "የውስጥ ገጽታዎችን በዓይነ ብርሃን መታመን",
          "መዘግየት እንዳይኖር በፍጥነት መክፈል",
        ],
        answerIdx: 1,
        explainEn: "Process beats perception: verification through a known channel and dual approval make forged emails worthless.",
        explainAm: "ሂደት ከግንዛቤ ይበልጣል፦ በታወቀ ቻናል ማረጋገጥና ጥምር ማጽደቅ የተቀየሩ ኢሜይሎችን ዋጋ የሌላቸው ያደርጋቸዋል።",
      },
    ],
  },
  {
    code: "AW-15",
    sortOrder: 15,
    topic: "data_duties",
    audience: "AWARE",
    titleEn: "Personal Data Duties at Work",
    titleAm: "በሥራ ላይ የግል መረጃ ግዴታዎች",
    summaryEn: "What Proclamation 1321/2024 means for staff who handle customer and citizen data every day: minimisation, purpose, security, breach reporting.",
    summaryAm: "አዋጅ 1321/2024 የደንበኛና የዜጋ መረጃ ለሚያስተናግዱ ሠራተኞች ምን ማለት ነው፦ ማነስ፣ ዓላማ፣ ደህንነት፣ የግልጽነት ሪፖርት።",
    durationMin: 20,
    gradeBand: "adult",
    contentEn: `## You are a data handler now
If your work touches customer records, staff files, patient notes, student results or payment data, the Personal Data Protection Proclamation No. 1321/2024 treats you as part of a controller's or processor's data-handling chain. Its duties are not for the legal department alone — they are operational habits, and breaches usually start with a routine shortcut.

## The everyday principles
**Purpose limitation**: data collected for one stated purpose is not quietly reused for another. **Minimisation**: collect only the fields the purpose needs — a loyalty card does not need a national ID number. **Accuracy**: correct errors when people point them out. **Storage limitation**: delete or anonymise when the purpose expires. **Security**: access on a need-to-know basis, strong authentication, encrypted transport.

## Practical habits that carry the law
Lock your screen every time you stand up. Do not move customer data to personal drives, personal email, or unsanctioned chat apps. Share files by reference, not by attachment copies. Report a lost phone or laptop the same hour. When someone asks "just send me the list", ask which purpose it serves — that single question is the proclamation in action.

## Data subject rights are operational, not theoretical
People can ask what you hold about them, demand corrections, and object to certain processing. These requests arrive at the reception desk and the call centre, not at the lawyer's office. Staff must recognise them, record them, and route them — losing a rights request is itself a compliance failure. This platform's Phase 1 automation exists precisely to keep organisations ready for such moments.

## Breach reporting: the clock is short
A personal-data breach — loss, leak, or unauthorised access — must be reported to the supervisory authority within 72 hours, and affected people notified when the risk to them is high. The worst breach response is silence: report internally immediately, preserve evidence, and let the notification process run. Hiding a breach turns a technical incident into a personal legal exposure.

## Special care categories
Religion, health, ethnicity, political opinion and similar sensitive categories demand extra justification and tighter access. A hospital list, a church membership roll, an NGO beneficiary list — treat each with the respect the law demands.`,
    contentAm: `## አሁን የመረጃ አስተናጋጅ ነህ
ሥራህ የደንበኛ መዝገቦችን፣ የሠራተኛ ፋይሎችን፣ የታካሚ ማስታወሻዎችን፣ የተማሪ ውጤቶችን ወይም የክፍያ መረጃን ከዳሰሰ፣ የግል መረጃ ጥበቃ አዋጅ ቁጥር 1321/2024 እንደ መቆጣጠሪያና አስኪያጅ አካል ይቆጥርሃል። ግዴታዎቹ ለሕግ ክፍል ብቻ አይደሉም — የክንድ ክፍል ተግባራዊ ተግባራት ናቸው፤ ግልጽነቶችም ብዙ ጊዜ በተለመደ አቋራጭ ይጀምራሉ።

## የዕለት ተዕለት መርሆች
**የዓላማ ገደብ**፦ ለአንድ የተገለጸ ዓላማ የተሰበሰበ መረጃ በጸጥታ ለሌላ አገልግሎት አይለጠፍም። **ማነስ**፦ ዓላማው የሚያስፈልጉትን መስኮች ብቻ ሰብስብ — የታማኝነት ካርድ ብሔራዊ መለያ ቁጥር አያስፈልገውም። **ትክክለኛነት**፦ ሰዎች ስህተት ሲጠቁሙ አስተካክል። **የማከማቻ ገደብ**፦ ዓላማው ሲያበቃ ሰርዝ ወይም ስም-አጥ። **ደህንነት**፦ መዳረሻ በአስፈላጊነት ላይ ብቻ፣ ጠንካራ ማረጋገጫ፣ የተመሰጠረ ማስተላለፍ።

## ሕጉን የሚሸከሙ ተግባራዊ ልማዶች
እያለቀህ ሲነሳ ስክሪንህን ዝጋ። የደንበኛ መረጃን ወደ ግል ድራይቭ፣ ወደ ግል ኢሜይል ወይም ወደ ያልተፈቀደ ውይይት መተግበሪያ አታስተላልፍ። ፋይሎችን በቅጂ ሳይሆን በማጣቀሻ ሼር አድርግ። የጠፋ ስልክ ወይም ላፕቶፕ በዚያው ሰዓት ሪፖርት አድርግ። ማንም "ዝርዝሩን ልክልኝ" ሲል የትኛውን ዓላማ እንደሚያገለግል ጠይቅ — ያ አንድ ጥያቄ ራሱ አዋጁ በተግባር መገለጫ ነው።

## የመረጃ ባለቤት መብቶች ግብረ-ተግባራዊ ናቸው
ሰዎች ምን እንዳዘምን መጠየቅ፣ ማስተካከልን መጠየቅ፣ አንዳንድ አያያዝን መቃወም ይችላሉ። እነዚህ ጥያቄዎች በአዳሪ ጠረጴዛና በስልክ አገልግሎት ይደርሳሉ — በጠበቂው ቢሮ አይደለም። ሠራተኞች መለየት፣ መመዝገብና ማስተላለፍ አለባቸው — የመብት ጥያቄን ማጣት ራሱ የቅጥ አልተከበረም ነው። የዚህ መድረክ የደረጃ 1 ራስ-ሰር አገልግሎት ድርጅቶችን ለእንዲህ ያሉ ጊዜያት ተዘጋጅቶ ለመቆየት ተቀምጧል።

## የግልጽነት ሪፖርት፦ ሰዓቱ አጭር ነው
የግል መረጃ ግልጽነት — መጥፋት፣ መፍሰስ ወይም ያልተፈቀደ መዳረሻ — በ72 ሰዓት ውስጥ ለቁጥጥር አካሉ ሪፖርት መደረግ አለበት፤ ለተጎዱትም ሰዎች ስጋቱ ከፍ ባለበት ጊዜ ማሳወቅ ይገባል። ከሁሉ ደካማው ምላሽ ጸጥታ ነው፦ ወዲያውኑ በውስጥ ሪፖርት አድርግ፣ ማስረጃ ጠብቅ፣ የማሳወቂያ ሂደቱ ሩጥ እንዲሆን ፍቀድ። ግልጽነትን መደበቅ ቴክኒካዊ አደጋን ወደ ግል ሕጋዊ ተጋላጭነት ይቀይረዋል።

## ልዩ እንክብካቤ ምድቦች
ሃይማኖት፣ ጤና፣ ብሔር፣ የፖለቲካ አመለካከትና ተመሳሳይ ስሜታዊ ምድቦች ተጨማሪ ማስረጃና ጠባብ መዳረሻ ይጠይቃሉ። የሆስፒታል ዝርዝር፣ የቤተክርስቲያን አባላት መዝገብ፣ የመልስ አገልግሎት ተጠቃሚዎች ዝርዝር — እያንዳንዱን ሕጉ በሚጠይቀው አክብሮት ያስተናግዱ።`,
    questions: [
      {
        promptEn: "A colleague asks you to email the full customer database to their personal address for weekend work. Right response?",
        promptAm: "ጓደኛህ ለዋለቀኛ ሥራ ሙሉውን የደንበኛ መረጃ ቤዝ ወደ ግል አድራሻው እንድታስተላልፍ ይጠይቅሃል። ትክክለኛው ምላሽ ምንድን ነው?",
        optionsEn: [
          "Send it — colleagues can be trusted",
          "Refuse: use the sanctioned internal system with need-based access",
          "Send only half the records",
          "Send it with a password in a separate email",
        ],
        optionsAm: [
          "ላከው — ጓደኞች ሊታመኑ ይችላሉ",
          "አትላክ፦ የተፈቀደውን የውስጥ ሥርዓት በአስፈላጊነት መዳረሻ ተጠቀም",
          "ግማሽውን መዝገብ ብቻ ላክ",
          "በተለየ ኢሜይል የይለፍ ቃል በማያያዝ ላከው",
        ],
        answerIdx: 1,
        explainEn: "Moving personal data to private channels breaks purpose limitation, security and often the contract itself. Work happens where controls live.",
        explainAm: "የግል መረጃን ወደ ግል ቻናሎች ማዛወር የዓላማ ገደብን፣ ደህንነትን እና ብዙ ጊዜ ውልኑንም ያወይዛል። ሥራ ቁጥጥር በትኛው ሥርዓት ውስጥ የት ነው የሚሠራው።",
      },
      {
        promptEn: "A personal-data breach is confirmed on Friday evening. When must the supervisory authority be told?",
        promptAm: "የግል መረጃ ግልጽነት ዓርብ ማታ ተረጋግጧል። ለቁጥጥር አካሉ መነገር ያለበት መቼ ነው?",
        optionsEn: [
          "Within 72 hours of becoming aware",
          "Next quarter with the report",
          "Only if the media finds out",
          "Never — it is internal",
        ],
        optionsAm: [
          "ከተረዳህ በ72 ሰዓት ውስጥ",
          "በሚቀጥለው ሩብ ዓመት ከሪፖርቱ ጋር",
          "ሚዲያ ካገኘው ብቻ",
          "በጭራሽ — ውስጣዊ ጉዳይ ነው",
        ],
        answerIdx: 0,
        explainEn: "The proclamation sets a 72-hour notification window from awareness — weekends included. Early internal escalation keeps the window reachable.",
        explainAm: "አዋጁ ከመረዳት ጀምሮ በ72 ሰዓት ውስጥ የማሳወቂያ መስኮት ይሰጣል — ሳምንት መጨረሻዎችም ጭምር። ቀድመህ ውስጣዊ ማሳደግ መስኮቱን ያሳካል።",
      },
      {
        promptEn: "A customer at the counter asks what data your organisation holds about her. What do you do?",
        promptAm: "በአገልግሎት መስጫው ላይ ደንበኛ ድርጅታችሁ ስላ ምን መረጃ እንደያዛት ትጠይቃለች። ምታደርገው ምንድን ነው?",
        optionsEn: [
          "Ignore her — only lawyers handle that",
          "Recognise it as a data-subject rights request, record and route it",
          "Print everything immediately",
          "Tell her to forget about it",
        ],
        optionsAm: [
          "ችላ በሏት — ያንን ጠበቂዎች ብቻ ይሠራሉ",
          "እንደ የመረጃ ባለቤት መብት ጥያቄ አውቀህ መዝግበህ አስተላልፈው",
          "ወዲያውኑ ሁሉንም አትም",
          "እሷን ስለዚህ ጉዳይ እንድትረሳ ንገራት",
        ],
        answerIdx: 1,
        explainEn: "Access requests arrive anywhere staff meet the public. Recognising, recording and routing them is the operational duty — losing them is a failure.",
        explainAm: "የመዳረሻ ጥያቄዎች ሠራተኞች ሕዝብ ባገኙበት ማንኛውም ቦታ ይደርሳሉ። መለየት፣ መመዝገብና ማስተላለፍ የክንድ ክፍል ግዴታ ነው — ማጣታቸው ውድቀት ነው።",
      },
    ],
  },
];

/* The RQ2 pre/post knowledge instrument is a fixed draw from the quiz banks:
 * the first and third item of each module (in persisted bank order) → 16
 * paired items, identical in PRE and POST so the gain is attributable to the
 * curriculum. The draw is resolved server-side in the learn APIs and is
 * pinned to the CyberSafe Kids pilot curriculum (AWARENESS_MODULES above) —
 * the TEENS/PRO/AWARE units are supplementary learning and never enter the
 * instrument. */
