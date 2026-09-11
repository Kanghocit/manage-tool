export type StudyExampleSeed = { en: string; vi: string };

export type StudyWordSeed = {
  id: string;
  word: string;
  pos: string;
  ipa: string;
  definitionVi: string;
  definitionEn: string;
  examples: StudyExampleSeed[];
  imageEmoji: string;
  sortOrder: number;
};

export type StudyListSeed = {
  id: string;
  title: string;
  description: string;
  words: StudyWordSeed[];
};

export const STUDY_VOCABULARY_SEED: StudyListSeed[] = [
  {
    id: "list-1",
    title: "List 1 | Office & Workplace",
    description: "Từ vựng văn phòng và môi trường làm việc",
    words: [
      {
        id: "w1-1",
        word: "deadline",
        pos: "n",
        ipa: "/ˈdedlaɪn/",
        definitionVi: "hạn chót",
        definitionEn: "the latest time by which something must be done",
        examples: [
          {
            en: "We must meet the project _____ by Friday.",
            vi: "Chúng ta phải đáp ứng hạn chót dự án vào thứ Sáu.",
          },
        ],
        imageEmoji: "⏰",
        sortOrder: 0,
      },
      {
        id: "w1-2",
        word: "colleague",
        pos: "n",
        ipa: "/ˈkɒliːɡ/",
        definitionVi: "đồng nghiệp",
        definitionEn: "a person you work with",
        examples: [
          {
            en: "My _____ helped me finish the report.",
            vi: "Đồng nghiệp của tôi đã giúp tôi hoàn thành báo cáo.",
          },
        ],
        imageEmoji: "👥",
        sortOrder: 1,
      },
      {
        id: "w1-3",
        word: "schedule",
        pos: "n",
        ipa: "/ˈʃedjuːl/",
        definitionVi: "lịch trình",
        definitionEn: "a plan of activities or events and when they will happen",
        examples: [
          {
            en: "Check the meeting _____ before you leave.",
            vi: "Kiểm tra lịch họp trước khi bạn rời đi.",
          },
        ],
        imageEmoji: "📅",
        sortOrder: 2,
      },
      {
        id: "w1-4",
        word: "assign",
        pos: "v",
        ipa: "/əˈsaɪn/",
        definitionVi: "giao việc",
        definitionEn: "to give someone a job or responsibility",
        examples: [
          {
            en: "The manager will _____ tasks to each team member.",
            vi: "Quản lý sẽ giao việc cho từng thành viên.",
          },
        ],
        imageEmoji: "📋",
        sortOrder: 3,
      },
      {
        id: "w1-5",
        word: "promotion",
        pos: "n",
        ipa: "/prəˈməʊʃn/",
        definitionVi: "thăng chức",
        definitionEn: "a move to a higher position at work",
        examples: [
          {
            en: "She got a _____ after two years of hard work.",
            vi: "Cô ấy được thăng chức sau hai năm làm việc chăm chỉ.",
          },
        ],
        imageEmoji: "📈",
        sortOrder: 4,
      },
      {
        id: "w1-6",
        word: "attendance",
        pos: "n",
        ipa: "/əˈtendəns/",
        definitionVi: "sự có mặt",
        definitionEn: "the act of being present at a place",
        examples: [
          {
            en: "Good _____ is required at all team meetings.",
            vi: "Cần có mặt đầy đủ ở mọi cuộc họp nhóm.",
          },
        ],
        imageEmoji: "✅",
        sortOrder: 5,
      },
    ],
  },
  {
    id: "list-2",
    title: "List 2 | Travel & Hospitality",
    description: "Từ vựng du lịch và khách sạn",
    words: [
      {
        id: "w2-1",
        word: "reservation",
        pos: "n",
        ipa: "/ˌrezəˈveɪʃn/",
        definitionVi: "đặt chỗ",
        definitionEn: "an arrangement to keep something for you",
        examples: [
          {
            en: "I made a hotel _____ for three nights.",
            vi: "Tôi đã đặt phòng khách sạn ba đêm.",
          },
        ],
        imageEmoji: "🏨",
        sortOrder: 0,
      },
      {
        id: "w2-2",
        word: "itinerary",
        pos: "n",
        ipa: "/aɪˈtɪnərəri/",
        definitionVi: "lịch trình chuyến đi",
        definitionEn: "a plan for a journey including places to visit",
        examples: [
          {
            en: "Our travel agent sent the full _____.",
            vi: "Đại lý du lịch đã gửi lịch trình đầy đủ.",
          },
        ],
        imageEmoji: "🗺️",
        sortOrder: 1,
      },
      {
        id: "w2-3",
        word: "luggage",
        pos: "n",
        ipa: "/ˈlʌɡɪdʒ/",
        definitionVi: "hành lý",
        definitionEn: "bags and suitcases that you take when travelling",
        examples: [
          {
            en: "Please do not leave your _____ unattended.",
            vi: "Vui lòng không để hành lý không có người trông coi.",
          },
        ],
        imageEmoji: "🧳",
        sortOrder: 2,
      },
      {
        id: "w2-4",
        word: "departure",
        pos: "n",
        ipa: "/dɪˈpɑːtʃə/",
        definitionVi: "khởi hành",
        definitionEn: "the act of leaving a place",
        examples: [
          {
            en: "The _____ gate opens at 6 a.m.",
            vi: "Cổng khởi hành mở lúc 6 giờ sáng.",
          },
        ],
        imageEmoji: "✈️",
        sortOrder: 3,
      },
      {
        id: "w2-5",
        word: "destination",
        pos: "n",
        ipa: "/ˌdestɪˈneɪʃn/",
        definitionVi: "điểm đến",
        definitionEn: "the place where someone is going",
        examples: [
          {
            en: "Paris is our final _____ this summer.",
            vi: "Paris là điểm đến cuối cùng của chúng tôi mùa hè này.",
          },
        ],
        imageEmoji: "🌍",
        sortOrder: 4,
      },
    ],
  },
  {
    id: "list-3",
    title: "List 3 | Business & Finance",
    description: "Từ vựng kinh doanh và tài chính",
    words: [
      {
        id: "w3-1",
        word: "revenue",
        pos: "n",
        ipa: "/ˈrevənjuː/",
        definitionVi: "doanh thu",
        definitionEn: "money that a company receives from its business",
        examples: [
          {
            en: "Annual _____ increased by ten percent.",
            vi: "Doanh thu hàng năm tăng mười phần trăm.",
          },
        ],
        imageEmoji: "💰",
        sortOrder: 0,
      },
      {
        id: "w3-2",
        word: "investment",
        pos: "n",
        ipa: "/ɪnˈvestmənt/",
        definitionVi: "đầu tư",
        definitionEn: "money put into something to make a profit",
        examples: [
          {
            en: "The startup secured a large _____.",
            vi: "Startup đã huy động được khoản đầu tư lớn.",
          },
        ],
        imageEmoji: "📊",
        sortOrder: 1,
      },
      {
        id: "w3-3",
        word: "budget",
        pos: "n",
        ipa: "/ˈbʌdʒɪt/",
        definitionVi: "ngân sách",
        definitionEn: "a plan for how much money will be spent",
        examples: [
          {
            en: "We need to stay within the marketing _____.",
            vi: "Chúng ta cần nằm trong ngân sách marketing.",
          },
        ],
        imageEmoji: "🧮",
        sortOrder: 2,
      },
      {
        id: "w3-4",
        word: "profit",
        pos: "n",
        ipa: "/ˈprɒfɪt/",
        definitionVi: "lợi nhuận",
        definitionEn: "money gained after costs are paid",
        examples: [
          {
            en: "Net _____ rose in the last quarter.",
            vi: "Lợi nhuận ròng tăng trong quý vừa qua.",
          },
        ],
        imageEmoji: "💹",
        sortOrder: 3,
      },
    ],
  },
];
