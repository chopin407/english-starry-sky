import type { Essay } from "../../lib/essays";

export default [
  {
    id: "sports-field",
    title: "我最喜欢的校园一角 · 操场",
    englishTitle: "My Favorite Place in My School",
    topic: "校园生活",
    summary: "先说最喜欢哪里，再用打篮球、跑步和体育课上的经历说明原因。",
    versions: [
      {
        label: "基础版",
        paragraphs: [
          "There are many interesting places in my school. My favorite place is the sports field.",
          "I like it best for two reasons. First, it makes me not only relaxed but also healthy. Second, it reminds me of the hard work I put into my training.",
          "I often do many activities on the sports field. First of all, I often spend an hour playing basketball with my friends after lunch. Besides, I become stronger and healthier than before by running. I also train hard on the sports field in PE class.",
          "In a word, the sports field is my favorite place in my school.",
        ],
      },
      {
        label: "提高版",
        paragraphs: [
          "There are many interesting places in my school. As for me, my favorite place is the sports field.",
          "The reasons why I like it best are as follows. First, it is the sports field that makes me not only relaxed but also healthy. Second, it reminds me of how hard I have trained during my school days.",
          "I often do many activities on the sports field. First of all, I often spend an hour playing basketball with my friends after lunch, which helps me relax and make new friends. Besides, there is nothing better than exercising on the sports field because running makes me stronger and healthier than before. What's more, training hard in PE class gives me a sense of achievement.",
          "In a word, the sports field is my favorite place in my school, and it holds many happy memories of my school life.",
        ],
      },
    ],
    outline: [
      "开头点题。用 there be 交代学校里有很多地方，然后说自己最喜欢操场。",
      "写清理由和活动。先说操场让你放松、健康，再写什么时候和谁打球，以及跑步带来的变化。",
      "结尾回扣最喜欢的地方。提高版可以补一句这个地方留下了怎样的回忆。",
    ],
    grammar: [
      {
        title: "there be 表示某处有某物",
        example: "There are many interesting places in my school.",
        translation: "我的学校有许多有趣的地方。",
        explanation:
          "结构是 There + be + 人或物 + 地点。这里 places 是复数，所以用 are。换成一个操场时可以写 There is a sports field in my school.",
        tip: "介绍学校里有的设施可以用 there be。主语换成 My school 时用 has，写作 My school has a sports field.",
      },
      {
        title: "spend + 时间 + doing",
        example: "I often spend an hour playing basketball with my friends after lunch.",
        translation: "午饭后我常花一小时和朋友打篮球。",
        explanation:
          "I 是花时间的人，an hour 说明用时，playing basketball 说明这段时间在做什么。after lunch 放在句末交代时间。",
        tip: "spend an hour 后接 playing，不能写 to play。hour 的 h 不发音，所以用 an hour。",
      },
      {
        title: "make + 宾语 + 形容词",
        example: "It makes me not only relaxed but also healthy.",
        translation: "它让我既放松又健康。",
        explanation:
          "me 是宾语，relaxed 和 healthy 都是说明 me 状态的形容词。not only A but also B 把这两个同类成分连起来。",
        tip: "relaxed 描述人的感受，relaxing 描述让人放松的事物。可说 I feel relaxed 和 Running is relaxing.",
      },
      {
        title: "by doing 与比较级",
        example: "I become stronger and healthier than before by running.",
        translation: "通过跑步，我比以前更强壮、更健康了。",
        explanation:
          "than before 给出比较对象。by running 说明达成变化的方法。strong 加 -er，healthy 把词尾 y 改成 i 再加 -er。",
        tip: "by 表示方式时后面接 running。healthier 已经是比较级，前面不再加 more。",
      },
      {
        title: "用强调句突出操场",
        example: "It is the sports field that makes me not only relaxed but also healthy.",
        translation: "正是操场让我既放松又健康。",
        explanation:
          "It is + 强调部分 + that + 其余部分。去掉 It is 和 that，恢复成 The sports field makes me not only relaxed but also healthy. 这里强调的是主语。",
        tip: "the sports field 是单数，因此用 makes。基础写作直接用普通句也能完整表达。",
      },
    ],
    vocabulary: [
      {
        term: "sports field",
        meaning: "运动场，操场",
        usage: "写本校特定的操场用 the sports field。写活动的位置用 on the sports field。",
      },
      {
        term: "like … best",
        meaning: "最喜欢……",
        usage: "I like the sports field best. 与 The sports field is my favorite place. 可以换用。",
      },
      {
        term: "remind sb. of sth.",
        meaning: "让某人想起某事",
        usage: "It reminds me of my training. of 后可以接表示一段经历的名词或短语。",
      },
      {
        term: "a sense of achievement",
        meaning: "成就感",
        usage: "常和 give 搭配。Finishing the race gives me a sense of achievement. 写出了感受来自哪件事。",
      },
      {
        term: "PE class",
        meaning: "体育课",
        usage: "PE 是 physical education 的缩写，字母大写。在体育课上可写 in PE class。",
      },
      {
        term: "first of all / what's more / in a word",
        meaning: "首先／此外／总之",
        usage: "前两个用来展开要点，最后一个用在总结。放句首时后面通常加逗号。",
      },
    ],
  },
  {
    id: "school-garden",
    title: "我最喜欢的校园一角 · 小花园",
    englishTitle: "The Small Garden in My School",
    topic: "校园生活",
    summary: "按空间顺序介绍花园，再写阅读、聊天和观鱼的日常。",
    versions: [
      {
        label: "范文",
        paragraphs: [
          "My favorite place in my school is the small garden. It is full of colorful flowers and green plants, and there are some wooden benches under the trees. In the middle of the garden, there is a small pond where there are some fish.",
          "I often sit quietly on a bench to read my favorite books or simply enjoy the peace around me. Sometimes I chat with my friends about our school days. Besides, I often watch the fish swimming in the pond.",
          "The reasons why I love it are as follows. First, it is peaceful and the air always smells fresh. Second, I can relax in the garden after busy classes. Finally, I can chat with friends freely there.",
          "In a word, I love this little garden at my school. It always brings me joy.",
        ],
      },
    ],
    outline: [
      "第一段先点题，接着按整体、树下、花园中央的顺序介绍景物。",
      "第二段用 read、chat、watch 写出自己在那里做的三件事。",
      "最后说明喜欢的原因，再用一句话收束到自己的感受。",
    ],
    grammar: [
      {
        title: "some 后的名词单复数",
        example: "There are some wooden benches under the trees.",
        translation: "树下有几张木长椅。",
        explanation:
          "这里 some 表示若干张，bench 是可数名词，所以要用复数 benches，be 动词用 are。bench 以 -ch 结尾，复数加 -es。",
        tip: "some 也可以修饰不可数名词，如 some water。此时 there be 用 is。",
      },
      {
        title: "where 引导地点定语从句",
        example: "In the middle of the garden, there is a small pond where there are some fish.",
        translation: "花园中央有一个小池塘，里面有一些鱼。",
        explanation:
          "where 紧跟 pond，表示 in the pond。后面的 there are some fish 本身有完整的句子结构，where 补充鱼所在的地点。",
        tip: "如果从句缺宾语，如 a pond that we can see from the classroom，用 that 或 which。",
      },
      {
        title: "to do 说明做事目的",
        example: "I often sit quietly on a bench to read my favorite books.",
        translation: "我常安静地坐在长椅上读最喜欢的书。",
        explanation:
          "to read 说明坐下来的目的。quietly 是副词，修饰 sit。也可写 I go to the garden to relax after class.",
        tip: "表示目的用 to read，不用 for read。形容花园安静可以说 The garden is quiet.",
      },
      {
        title: "watch + 宾语 + doing",
        example: "I often watch the fish swimming in the pond.",
        translation: "我常看鱼儿在池塘里游。",
        explanation:
          "the fish 是 watch 的宾语，swimming 描写观察到的动作正在进行。watch the fish swim 也成立，侧重看到这个动作。",
        tip: "watch 后的动作不加 to。这里 fish 是鱼的常用复数形式。",
      },
      {
        title: "感官动词 smell + 形容词",
        example: "The air always smells fresh.",
        translation: "空气总是闻起来很清新。",
        explanation:
          "smell 在句中是系动词，fresh 描述空气的状态。类似结构还有 look clean、sound interesting、feel warm。",
        tip: "air 是不可数名词，在这里作单数，写 smells。fresh 也不要改成副词 freshly。",
      },
    ],
    vocabulary: [
      {
        term: "be full of",
        meaning: "充满……",
        usage: "of 后接名词。The garden is full of colorful flowers. 用具体名词写景。",
      },
      {
        term: "wooden bench",
        meaning: "木长椅",
        usage: "wooden 是形容词，放在 bench 前。坐在长椅上用 sit on a bench。",
      },
      {
        term: "in the middle of",
        meaning: "在……中央",
        usage: "用于交代位置。In the middle of the garden, there is a pond. 地点短语放在句首可以加逗号。",
      },
      {
        term: "chat with sb. about sth.",
        meaning: "和某人聊某事",
        usage: "with 引出聊天对象，about 引出话题。可以写 chat with my friends about our school days。",
      },
      {
        term: "peaceful / peacefully",
        meaning: "安静的／安静地",
        usage: "a peaceful place 用形容词修饰名词，sit peacefully 用副词修饰动作。",
      },
      {
        term: "bring sb. joy",
        meaning: "给某人带来快乐",
        usage: "Reading in the garden brings me joy. bring 后先接人，再接事物。",
      },
    ],
  },
  {
    id: "introducing-myself",
    title: "介绍自己并邀请交朋友",
    englishTitle: "Introducing Myself",
    topic: "自我介绍",
    summary: "从身份、性格写到爱好，用具体习惯和事例让别人认识你。",
    versions: [
      {
        label: "基础版",
        paragraphs: [
          "My name is Li Hua. I am a 13-year-old girl from Class 1, Grade 7 at Hongxing Middle School. I live in Beijing with my family. I am tall and outgoing. I am always willing to help others.",
          "I have many hobbies. First of all, I love painting so much that I often spend an hour practicing painting every day. Besides painting, I also enjoy singing. I want to be a singer in the future.",
          "If you would like to make friends with me, you can call me at [phone number].",
        ],
      },
      {
        label: "提高版",
        paragraphs: [
          "Hello, everyone. I am happy to introduce myself to you.",
          "My name is Li Hua. I am a 13-year-old girl from Class 1, Grade 7 at Hongxing Middle School. I live in Beijing with my family. I am tall and outgoing. I am always willing to help others whenever they have difficulties.",
          "I have many hobbies. First of all, I love painting so much that I often spend an hour practicing painting every day. Besides painting, I also enjoy singing. I have been learning to sing since I was six. I often take part in singing competitions and have won a lot of prizes. I want to be a singer in the future.",
          "If you would like to make friends with me, you can call me at [phone number]. I really hope we can get to know each other better.",
        ],
      },
    ],
    outline: [
      "先介绍姓名、年龄、学校和班级。再用外貌和性格词补充人物特点。",
      "挑一两个爱好展开，写多久练一次、参加过什么活动或将来想做什么。",
      "最后发出交友邀请。范文用 [phone number] 表示电话号码占位。",
    ],
    grammar: [
      {
        title: "年龄作定语时用连字符",
        example: "I am a 13-year-old girl from Class 1, Grade 7.",
        translation: "我是一名来自七年级一班的 13 岁女孩。",
        explanation: "13-year-old 整体修饰 girl，year 用单数。年龄放在 be 动词后单独作表语时，用 I am 13 years old.",
        tip: "a 13-year-old girl 有两处连字符，不能写 a 13 years old girl。",
      },
      {
        title: "so … that … 表示程度和结果",
        example: "I love painting so much that I often spend an hour practicing painting every day.",
        translation: "我特别喜欢画画，以至于经常每天花一个小时练习。",
        explanation:
          "so much 说明喜欢的程度，that 后是这种程度带来的结果。spend 后用 practicing，practice 后同样可接 doing，所以出现 practicing painting。",
        tip: "that 后需要完整句子。只想说很喜欢时，可简化成 I love painting very much.",
      },
      {
        title: "since 从句说明起点",
        example: "I have been learning to sing since I was six.",
        translation: "我从六岁起一直在学唱歌。",
        explanation:
          "since I was six 指开始的时间。have been learning 表示从过去开始并持续到现在。七年级写作也可以用 I started learning to sing at the age of six. 清楚交代起点。",
        tip: "since 后用起点，for 后用时长，例如 for three years。",
      },
      {
        title: "if 引出交友邀请的条件",
        example: "If you would like to make friends with me, you can call me at [phone number].",
        translation: "如果你想和我交朋友，可以打这个电话号码。",
        explanation: "If 从句提出条件，you can call me 说可以采取的行动。would like to do 比 want to do 更委婉。",
        tip: "if 从句放句首时，用逗号和主句分开。电话号码前用 at。",
      },
    ],
    vocabulary: [
      {
        term: "introduce myself to you",
        meaning: "向你介绍我自己",
        usage: "introduce A to B。主语是 I，介绍自己用反身代词 myself。",
      },
      {
        term: "outgoing",
        meaning: "外向的，爱交际的",
        usage: "可以写 I am outgoing. 再补一句 I enjoy meeting new people. 给读者一个例子。",
      },
      {
        term: "be willing to do",
        meaning: "愿意做……",
        usage: "I am willing to help others. willing 后接 to 和动词原形。",
      },
      {
        term: "take part in / win a prize",
        meaning: "参加／获奖",
        usage: "take part in a competition 强调参加一项活动。写获多个奖用 win prizes。",
      },
      {
        term: "besides painting",
        meaning: "除了画画之外还……",
        usage: "besides 此处表示追加。它后面可接名词或动词的 -ing 形式。",
      },
      {
        term: "get to know each other",
        meaning: "逐渐互相了解",
        usage: "get to know 强调认识和了解的过程。each other 表示互相。",
      },
    ],
  },
  {
    id: "joining-the-art-club",
    title: "介绍自己并申请加入美术社团",
    englishTitle: "Why I Want to Join the Art Club",
    topic: "社团活动",
    summary: "把爱好、特长和入社目标连起来，用两三条具体理由说明为什么想加入。",
    versions: [
      {
        label: "基础版",
        paragraphs: [
          "I am a 14-year-old student. I am outgoing and patient, and I am tall with short hair. I love painting and I am good at drawing cartoons. I often spend an hour painting every day.",
          "I want to join the art club for two reasons. First, my art teacher is kind, and her paintings are beautiful. Second, I want to be a painter when I grow up. I can improve my painting skills in the art club.",
        ],
      },
      {
        label: "提高版",
        paragraphs: [
          "I am a 14-year-old student who is outgoing and patient. I am tall with short hair. I love painting and I am good at drawing cartoons, which brings me lots of joy in my free time. I usually spend an hour practicing painting every day.",
          "I want to join the art club for several reasons. First, my art teacher is kind, and her paintings are so beautiful that I want to learn from her. Second, it is a good chance to share my ideas about painting with my classmates in the art club. Besides, I want to be an illustrator when I grow up. The art club can help me improve my painting skills.",
        ],
      },
    ],
    outline: [
      "用一两句介绍年龄、外貌和性格。",
      "说自己擅长什么，并用日常练习的时间或作品证明这项爱好。",
      "写明想加入的社团，用老师、同伴交流、未来目标等具体理由展开。",
    ],
    grammar: [
      {
        title: "who 引导修饰人的定语从句",
        example: "I am a 14-year-old student who is outgoing and patient.",
        translation: "我是一名 14 岁、外向又有耐心的学生。",
        explanation:
          "who 修饰 student，并在从句中作主语。student 是单数，所以用 is。基础版可以把定语从句拆成 I am a student. I am outgoing and patient.",
        tip: "who 已经代替 student，后面不用再写 he 或 she。",
      },
      {
        title: "be good at + 名词或 doing",
        example: "I love painting and I am good at drawing cartoons.",
        translation: "我喜欢画画，也擅长画卡通。",
        explanation: "at 是介词，drawing cartoons 是擅长的活动。and 连接两个对自己的介绍。还可以写 be good at art。",
        tip: "这里用 drawing，不能写 good at draw。be good with people 表示善于和人相处，含义不同。",
      },
      {
        title: "a chance to do 表示做某事的机会",
        example: "It is a good chance to share my ideas about painting with my classmates.",
        translation: "这是和同学交流绘画想法的好机会。",
        explanation: "to share 说明 chance 的具体内容。share sth. with sb. 先写分享的内容，再写对象。",
        tip: "和同学分享用 with my classmates。in the art club 前面的 the 指前文提到的那个社团。",
      },
      {
        title: "when 引导时间状语从句",
        example: "I want to be an illustrator when I grow up.",
        translation: "我长大后想成为一名插画师。",
        explanation: "主句交代梦想，when 从句交代什么时候。这里虽然说的是将来，从句仍用一般现在时 grow up。",
        tip: "illustrator 以元音音素开头，用 an。painter 以辅音音素开头，用 a。",
      },
    ],
    vocabulary: [
      { term: "patient", meaning: "有耐心的", usage: "这里是形容词。be patient with sb. 表示对某人有耐心。" },
      {
        term: "with short hair",
        meaning: "留着短发",
        usage: "with 描写外貌。a student with short hair 表示一个留短发的学生。hair 泛指头发时通常不可数。",
      },
      {
        term: "join the art club",
        meaning: "加入美术社团",
        usage: "成为社团成员用 join。参加某一项比赛可用 take part in a competition。",
      },
      {
        term: "in my free time",
        meaning: "在我的空闲时间",
        usage: "可放在句首或句末。I draw cartoons in my free time.",
      },
      {
        term: "illustrator / painter",
        meaning: "插画师／画家",
        usage: "illustrator 常为书籍或其他内容配图。painter 在本文指创作绘画作品的人。",
      },
      {
        term: "improve my painting skills",
        meaning: "提高我的绘画技能",
        usage: "improve 后直接接要提升的能力。也可以换成 improve my English。",
      },
    ],
  },
  {
    id: "my-family",
    title: "我的家庭和家人",
    englishTitle: "My Family",
    topic: "家庭生活",
    summary: "按人物介绍年龄、职业、外貌和爱好，再用共同活动写出家人的陪伴。",
    versions: [
      {
        label: "基础版",
        paragraphs: [
          "There are four people in my family. They are my grandmother, my father, my mother and I.",
          "My father is 45 years old and works as a doctor. He is handsome and hard-working. He enjoys playing sports and often spends an hour playing basketball with me on weekends. My mother has long black hair. She is 43 and works as a teacher. She is patient and often reads books with me.",
          "My grandmother is 65. She likes walking in the park, so she is thin and healthy. She is so kind that she cooks delicious food for us every day.",
          "In a word, my family is warm and I love my family members.",
        ],
      },
      {
        label: "提高版",
        paragraphs: [
          "There are four people in my family. They are my grandmother, my father, my mother and I.",
          "My father, who is 45 years old and works as an engineer, is very handsome. He not only works hard but also enjoys playing sports in his free time. He often spends an hour playing basketball with me on weekends. My mother has long black hair. She is a patient teacher. She loves reading and often reads books with me, which broadens my horizons.",
          "As for my 65-year-old grandmother, she likes walking in the park, so she is thin and healthy. More importantly, she is so kind that she cooks delicious food for us every day.",
          "In a word, it is my loving family that gives me endless love and support, which helps me grow up healthy and happy.",
        ],
      },
    ],
    outline: [
      "开头交代家里有几个人，列出家庭成员。",
      "正文按人物介绍，每人挑两三个有区别的特点，再写一件具体的日常活动。",
      "结尾从活动回到感情，说明家人给你的爱、支持或陪伴。",
    ],
    grammar: [
      {
        title: "who 从句补充人物信息",
        example: "My father, who is 45 years old and works as an engineer, is very handsome.",
        translation: "我爸爸很英俊。他 45 岁，是一名工程师。",
        explanation:
          "My father 已经明确指谁，两个逗号之间的 who 从句补充年龄和职业。去掉从句后，主句 My father is very handsome. 仍完整。",
        tip: "这个补充说明的从句用 who，不能改成 that。拆成两三句也能写清楚。",
      },
      {
        title: "not only A but also B 要并列同类成分",
        example: "He not only works hard but also enjoys playing sports in his free time.",
        translation: "他不仅工作努力，还喜欢在空闲时间运动。",
        explanation:
          "works hard 和 enjoys playing sports 都是以动词开头的短语，共用主语 he。把 not only 放在 works 前面，句子保留正常语序。",
        tip: "七年级写作优先用这一语序。留意两个谓语都要与 he 保持单数一致。",
      },
      {
        title: "which 可以指前面一件事",
        example: "She often reads books with me, which broadens my horizons.",
        translation: "她经常和我一起读书，这拓宽了我的视野。",
        explanation:
          "逗号后的 which 指一起读书这件事，在从句中作主语。用两句也可以写成 She often reads books with me. This broadens my horizons.",
        tip: "逗号后的补充性定语从句用 which，不能换成 that。这里用单数 broadens。",
      },
      {
        title: "so + 形容词 + that 从句",
        example: "She is so kind that she cooks delicious food for us every day.",
        translation: "她很关爱我们，每天都给我们做好吃的。",
        explanation: "so 修饰 kind，that 从句说明这种性格表现在哪里。若只想说她经常做饭，可以用两句分别写性格和行动。",
        tip: "避免写 so kind to she cooks。that 后有自己的主语 she 和谓语 cooks。",
      },
    ],
    vocabulary: [
      {
        term: "family member",
        meaning: "家庭成员",
        usage: "member 是可数名词。可写 I have three other family members. 这里 other 排除了自己。",
      },
      {
        term: "work as",
        meaning: "担任，以……为职业",
        usage: "as 后接职业。work as an engineer 和 work as a doctor 都要保留冠词。",
      },
      {
        term: "hard-working",
        meaning: "勤奋的",
        usage: "a hard-working person 用形容词修饰人。He works hard. 用 hard 修饰动词。",
      },
      {
        term: "long black hair",
        meaning: "黑色长发",
        usage: "英语常先写长短，再写颜色。hair 泛指头发时通常不用 a 或复数。",
      },
      {
        term: "broaden my horizons",
        meaning: "拓宽我的视野",
        usage: "常把阅读、旅行或学习写作拓宽视野的原因。Reading broadens my horizons.",
      },
      {
        term: "love and support",
        meaning: "爱与支持",
        usage: "give me love and support 可用在结尾，前面最好已有具体的陪伴事例。",
      },
    ],
  },
  {
    id: "favorite-classroom",
    title: "我最喜欢的房间 · 教室",
    englishTitle: "My Favorite Classroom",
    topic: "教室与设施",
    summary: "从前方、后部和墙面介绍真实教室，再说明喜欢这个空间的理由。",
    versions: [
      {
        label: "基础版",
        paragraphs: [
          "My favorite room is my classroom. It is smart and tidy. There are two blackboards in the classroom. One is at the front, and the other is at the back. We put up notices on the back blackboard. There is a smart whiteboard next to the front blackboard. There are forty-five sets of desks and chairs for us students. A clock is on the back wall. A map of China and a map of the world hang on opposite walls.",
          "I like my classroom for three reasons. First, it is quiet, so I can study well. Besides, a clean classroom is good for my health. Finally, I can talk with my friends there, which makes me happy and relaxed.",
          "In a word, my classroom is a good place to learn new things and develop my creativity and imagination.",
        ],
      },
      {
        label: "提高版",
        paragraphs: [
          "My favorite room is my classroom, which is smart and tidy. There are two blackboards. The front blackboard, which our teachers use during lessons, is large and clean. We put up notices on the other blackboard at the back. Next to the front blackboard is a smart whiteboard that makes our classes interesting. There are forty-five sets of desks and chairs for us students. There is a clock on the back wall, which helps us manage our time. A map of China and a map of the world hang on opposite walls, so it is easy for us to learn about geography.",
          "The reasons why I like my classroom are as follows. First, it is the quiet environment in the classroom that makes me love studying. Besides, the clean classroom is good for my health. Finally, I can talk about my school days with my friends there, which makes me happy and relaxed.",
          "In a word, my classroom is a good place where I can broaden my horizons and develop my creativity and imagination.",
        ],
      },
    ],
    outline: [
      "先总体评价教室，然后按位置介绍黑板、白板、桌椅、时钟和地图。",
      "第二段写喜欢教室的理由，并用安静学习、和同学聊天等细节支撑。",
      "最后把教室的意义落在学习、交友或发挥想象力上。",
    ],
    grammar: [
      {
        title: "one … the other … 描述两者",
        example: "There are two blackboards in the classroom. One is at the front, and the other is at the back.",
        translation: "教室里有两块黑板。一块在前面，另一块在后面。",
        explanation:
          "前一句先交代总数是二，one 和 the other 分别指其中一个和剩下的一个。后一句用 and 连接两个各有主语和谓语的分句。",
        tip: "有明确的两个对象时用 the other。再增加一个未介绍的同类物品时用 another。",
      },
      {
        title: "限制性与补充性定语从句",
        example: "Next to the front blackboard is a smart whiteboard that makes our classes interesting.",
        translation: "前面的黑板旁有一块让课堂变得有趣的智能白板。",
        explanation:
          "that makes our classes interesting 修饰白板，直接跟在名词后。对已明确的物品补充说明时，用逗号隔开，例如 The front blackboard, which our teachers use during lessons, is large and clean.",
        tip: "that 在例句的从句中作主语，不可省略。逗号后的补充说明用 which，不能用 that。",
      },
      {
        title: "地点放句首的倒装",
        example: "Next to the front blackboard is a smart whiteboard.",
        translation: "前面的黑板旁有一块智能白板。",
        explanation:
          "把地点放到句首，接谓语 is，再接名词主语 a smart whiteboard。写教室布局时可用这种顺序引导视线。普通语序是 A smart whiteboard is next to the front blackboard.",
        tip: "is 跟后面的主语一致。换成 two smart whiteboards 时要用 are。",
      },
      {
        title: "It is + 形容词 + for sb. + to do",
        example: "It is easy for us to learn about geography.",
        translation: "我们学习地理知识很方便。",
        explanation: "It 先占据主语位置，真正说明什么事容易的是 to learn about geography。for us 说明对谁而言。",
        tip: "不要把这个句型与 It is … that … 强调句混写。这里的 to learn 是结构的一部分。",
      },
      {
        title: "强调句与 make sb. do",
        example: "It is the quiet environment in the classroom that makes me love studying.",
        translation: "正是教室里安静的环境让我喜欢学习。",
        explanation:
          "还原后是 The quiet environment in the classroom makes me love studying. 被强调的是主语 environment，后面用 makes。love studying 中的 studying 是 love 的宾语。",
        tip: "make me 后面直接接动词原形 love。若说明人的状态，可以写 make me happy。",
      },
    ],
    vocabulary: [
      {
        term: "at the front / at the back",
        meaning: "在内部前部／后部",
        usage: "at the front of the classroom 说的是教室里面靠前的位置。in front of the classroom 常指教室外的前方。",
      },
      {
        term: "put up notices",
        meaning: "张贴通知",
        usage: "put up 后接要张贴的东西，张贴的位置用 on，例如 put up notices on the blackboard。",
      },
      {
        term: "a set of desks and chairs",
        meaning: "一套桌椅",
        usage: "计数时变化的是 set。forty-five sets 的中心词是复数 sets，所以前面用 There are。",
      },
      { term: "on the back wall", meaning: "在后墙表面上", usage: "时钟挂在墙上用 on。in the wall 通常指嵌在墙体里。" },
      {
        term: "manage our time",
        meaning: "管理好我们的时间",
        usage: "在写时钟的功能时可用 helps us manage our time，不用把“规律地学习生活”逐词翻译。",
      },
      {
        term: "creativity and imagination",
        meaning: "创造力和想象力",
        usage: "可以用 develop 同时搭配两个词。写结尾时也可举出具体活动，如设计海报或分享点子。",
      },
    ],
  },
  {
    id: "dream-classroom",
    title: "我梦想中的教室",
    englishTitle: "My Dream Classroom",
    topic: "想象写作",
    summary: "从空间布局写到设备用途，用全息教师、机器人和 VR 阅读区描绘未来教室。",
    versions: [
      {
        label: "修订范文",
        paragraphs: [
          "My dream classroom is a large room full of advanced technology. It is the high-tech environment in the classroom that makes me love studying.",
          "There is a huge projection screen on the wall. In front of it is a smart teacher’s desk, on which there is a box of chalk and a special board eraser. A holographic teacher can appear above the desk and give us lessons through a digital screen. Below the desk is a row of seats where students can attend classes. There are some robot cleaners behind the door, which help keep our classroom tidy. Near the windowsill is a row of bookcases filled with science and technology books. It is convenient for us to find the books we need. Next to the bookcases are some small VR devices. We can put a book into a slot and put on a VR headset so that we can explore the world described in the book. We often spend time reading in this area. A large screen is placed on the back wall, which shows how each student is doing at school. Next to it is a screen displaying school rules. Another screen displays paintings and information about them.",
          "In a word, my dream classroom is a wonderful place full of advanced technology. It provides us with a good learning environment and helps us develop not only our creativity but also our imagination.",
        ],
      },
    ],
    outline: [
      "第一段总体说明教室宽敞、充满科技感，并写它对学习兴趣的影响。",
      "第二段按讲台附近、窗边阅读区和后墙的顺序介绍设备。每组设施最好同时说明位置和用途。",
      "第三段从设备回到学习体验，说明这样的空间怎样帮助学生发挥创造力和想象力。",
    ],
    grammar: [
      {
        title: "强调句突出科技环境",
        example: "It is the high-tech environment in the classroom that makes me love studying.",
        translation: "正是教室里的高科技环境让我喜欢学习。",
        explanation:
          "It is 和 that 之间放被强调的主语。还原成普通句是 The high-tech environment in the classroom makes me love studying. make sb. do 中的 do 用原形。",
        tip: "强调句要写全 that。用 makes me love，不用 makes me to love。",
      },
      {
        title: "there be 与地点倒装交替使用",
        example: "Near the windowsill is a row of bookcases filled with science and technology books.",
        translation: "窗台附近有一排装满科技类图书的书柜。",
        explanation:
          "Near the windowsill 是地点，is 后的主语是 a row of bookcases，中心词 row 为单数。filled with … 修饰 bookcases，相当于 that are filled with …。也可以写 There is a row of bookcases near the windowsill.",
        tip: "书柜虽然有多个，这里谓语由 a row 决定。换成 some bookcases 后要用 are。",
      },
      {
        title: "where 与介词 + which",
        example:
          "In front of it is a smart teacher’s desk, on which there is a box of chalk and a special board eraser.",
        translation: "屏幕前是一张智能讲台，讲台上有一盒粉笔和一个特别的板擦。",
        explanation:
          "on which 指 on the desk，介词 on 把位置说得很具体。写 seats where students can attend classes 时，where 表示学生在哪里听课。",
        tip: "介词后用 which 指物。若从句缺的是宾语，可写 the books we need，省去作宾语的 that 或 which。",
      },
      {
        title: "形式主语 It 与真正的动作",
        example: "It is convenient for us to find the books we need.",
        translation: "我们找需要的书很方便。",
        explanation:
          "It 是形式主语，to find the books we need 才是被评价为方便的事，for us 表明对谁而言。the books we need 表示我们需要的书。",
        tip: "这种表达把方便的事情写出来。不能把人直接写成 We are convenient to find the books.",
      },
      {
        title: "so that 引出目的",
        example: "We can put on a VR headset so that we can explore the world described in the book.",
        translation: "我们可以戴上 VR 头显，以便探索书中描绘的世界。",
        explanation:
          "so that + 完整句子说明戴头显的目的。described in the book 修饰 world，意思相当于 that is described in the book。",
        tip: "so that 表示目的时连在一起。so interesting that I want to read it again 是 so + 形容词 + that，表示程度带来的结果。",
      },
      {
        title: "被动语态与宾语从句",
        example: "A large screen is placed on the back wall, which shows how each student is doing at school.",
        translation: "后墙上装有一块大屏幕，显示每位学生在校的表现。",
        explanation:
          "is placed 由 be 加过去分词组成，突出屏幕装在何处。how each student is doing at school 是 shows 的宾语从句，内部用主语 each student 在前的陈述语序。",
        tip: "写 how each student is doing，不写 how is each student doing。想让 which 的指代更清楚，也可以拆成 The screen shows …。",
      },
      {
        title: "not only … but also … 的平行结构",
        example: "It helps us develop not only our creativity but also our imagination.",
        translation: "它帮助我们培养创造力和想象力。",
        explanation:
          "our creativity 和 our imagination 都是名词短语，共用 develop。help sb. 后可以接动词原形，也可以接 to do。",
        tip: "not only 与 but also 成对使用，中间不再加 and。",
      },
    ],
    vocabulary: [
      {
        term: "high-tech / full of advanced technology",
        meaning: "高科技的／充满先进科技",
        usage: "可以写 a high-tech classroom。full of 短语放在名词后修饰它，如 a room full of advanced technology。",
      },
      {
        term: "projection screen / digital screen",
        meaning: "投影幕／数字屏幕",
        usage: "写屏幕上的内容用 on the screen。display 和 show 可以表示显示某项内容。",
      },
      {
        term: "holographic teacher / robot cleaner",
        meaning: "全息教师／清洁机器人",
        usage: "介绍想象中的设备时，用 can appear、give lessons 或 keep the classroom tidy 写清它的功能。",
      },
      {
        term: "a box of chalk",
        meaning: "一盒粉笔",
        usage: "chalk 在这里是不可数名词。一支可写 a piece of chalk，两盒写 two boxes of chalk。",
      },
      {
        term: "bookcase / windowsill",
        meaning: "书柜／窗台",
        usage: "bookcase 的复数是 bookcases。near the windowsill 表示靠近窗台，on the windowsill 表示放在窗台上。",
      },
      {
        term: "science and technology books",
        meaning: "科学技术类书籍",
        usage: "写科普或技术书籍可用这个表达。科幻小说或科幻故事用 science fiction。",
      },
      {
        term: "put … into a slot / put on a VR headset",
        meaning: "把……放进插槽／戴上 VR 头显",
        usage: "into 表示放入内部，put on 表示戴上的动作。slot 和 headset 为单数时需要冠词。",
      },
      {
        term: "provide sb. with sth.",
        meaning: "为某人提供某物",
        usage:
          "It provides us with a good learning environment. 也可以把物放在前面，写 provide a good learning environment for us。",
      },
    ],
  },
] satisfies Essay[];
