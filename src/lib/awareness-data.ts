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

/* The RQ2 pre/post knowledge instrument is a fixed draw from the quiz banks:
 * the first and third item of each module (in persisted bank order) → 16
 * paired items, identical in PRE and POST so the gain is attributable to the
 * curriculum. The draw is resolved server-side in the learn APIs. */
