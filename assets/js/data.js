// BUP Business & Communication Club (BUP BCC) Achievements Dataset
// Uses local asset file paths from index.html
const achievementsData = [
  {
    id: 1,
    title: "Battle of Minds 2025",
    organizer: "BAT Bangladesh",
    year: "2025",
    rank: "National Champion (1st)",
    teamName: "BUP Apex Strategy",
    members: [
      { name: "Samiul Alam", role: "Lead Strategist" },
      { name: "Nusrat Chowdhury", role: "Financial Analyst" },
      { name: "Tanvir Ahmed", role: "Brand & Marketing" }
    ],
    image: "assets/corporiddlerz-2025.jpg",
    description: "Formulated an ESG-driven circular business model for sustainable FMCG packaging, securing 1st place among 1,200+ university teams nationwide."
  },
  {
    id: 2,
    title: "Hult Prize at BUP 2025",
    organizer: "Hult Prize Foundation",
    year: "2025",
    rank: "On-Campus Champion",
    teamName: "EcoVenture BUP",
    members: [
      { name: "Farhan Ishraq", role: "Social Entrepreneur" },
      { name: "Ayesha Siddiqua", role: "Operations Lead" },
      { name: "Mahir Faisal", role: "Impact Assessment" }
    ],
    image: "assets/unilever-learn-to-lead-2025.jpg",
    description: "Pitched a scalable social enterprise creating biodegradable jute-based alternatives for single-use plastic packaging in urban e-commerce logistics."
  },
  {
    id: 3,
    title: "BizMaestros 2024",
    organizer: "Unilever Bangladesh",
    year: "2024",
    rank: "Grand Finalist (Top 5)",
    teamName: "BUP Visionaries",
    members: [
      { name: "Rakib Hassan", role: "Brand Manager" },
      { name: "Faria Rahman", role: "Consumer Insights" }
    ],
    image: "assets/gateway-ori.jpeg",
    description: "Designed a digital-first go-to-market strategy for sustainable personal care products targeting Gen-Z consumers in Bangladesh."
  },
  {
    id: 4,
    title: "Brandwitz 2024",
    organizer: "IBA, University of Dhaka",
    year: "2024",
    rank: "1st Runner Up (2nd)",
    teamName: "BUP BrandCrafters",
    members: [
      { name: "Asif Iqbal", role: "Campaign Strategist" },
      { name: "Mehnaz Tabassum", role: "Creative Director" },
      { name: "Saadman Sakib", role: "Media Planner" }
    ],
    image: "assets/creadive-idlc-2.jpg",
    description: "Crafted an integrated 360-degree brand repositioning campaign for a legacy retail conglomerate in South Asia."
  },
  {
    id: 5,
    title: "CreADive National Marketing Fest 2025",
    organizer: "BUP BCC & MarTech",
    year: "2025",
    rank: "Champion (1st Place)",
    teamName: "BUP AdVantage",
    members: [
      { name: "Shahriar Parvez", role: "Copywriter & Lead" },
      { name: "Lamia Hasan", role: "Visual Storyteller" }
    ],
    image: "assets/creadive-collage.png",
    description: "Outperformed 80+ university teams with an innovative guerrilla marketing activation for eco-friendly urban mobility."
  },
  {
    id: 6,
    title: "National Business Communication Summit 2024",
    organizer: "Corporate Executive Forum",
    year: "2024",
    rank: "Best Elevator Pitch",
    teamName: "BUP CommMasters",
    members: [
      { name: "Kazi Nabil", role: "Keynote Presenter" },
      { name: "Zarin Tasnim", role: "PR & Communications" }
    ],
    image: "assets/bizcomps-to-mnc.jpg",
    description: "Delivered a compelling 90-second investor pitch for a fintech micro-lending platform, winning top honors among 50 presenters."
  },
  {
    id: 7,
    title: "Corporiddlerz 2025 Strategy Contest",
    organizer: "BUP BCC",
    year: "2025",
    rank: "Grand Champion",
    teamName: "BUP LogiX",
    members: [
      { name: "Imran Hossain", role: "Supply Chain Analyst" },
      { name: "Sania Mirza", role: "Logistics Engineer" },
      { name: "Rezaul Karim", role: "Procurement Lead" }
    ],
    image: "assets/corporiddlerz-collage.png",
    description: "Optimized cold-chain distribution networks for pharmaceutical exports under severe geopolitical constraints."
  },
  {
    id: 8,
    title: "Biz Quest 2024",
    organizer: "BUP BCC",
    year: "2024",
    rank: "1st Runner Up (2nd)",
    teamName: "BUP Capital Analysts",
    members: [
      { name: "Tariqul Islam", role: "DCF Modeling Lead" },
      { name: "Nabila Huda", role: "M&A Strategist" }
    ],
    image: "assets/bizquest-collage.png",
    description: "Executed a comprehensive financial valuation and M&A pitch deck for a multi-billion dollar tech buyout scenario in Southeast Asia."
  },
  {
    id: 9,
    title: "CreADive 2023 Marketing Challenge",
    organizer: "BUP BCC & IDLC",
    year: "2023",
    rank: "Grand Champion (1st)",
    teamName: "BUP AdMinds",
    members: [
      { name: "Sharif Ahmed", role: "Creative Lead" },
      { name: "Taskin Reza", role: "Brand Director" }
    ],
    image: "assets/creadive-front.jpg",
    description: "Produced a viral commercial video and omni-channel advertising blueprint for an eco-friendly consumer tech startup."
  },
  {
    id: 10,
    title: "Asia-Pacific Inter-University Case Contest 2024",
    organizer: "APAC Business Network",
    year: "2024",
    rank: "Global Top 10 Finalist",
    teamName: "BUP APAC Delegates",
    members: [
      { name: "Tanvir Rahman", role: "International Strategy" },
      { name: "Siam Al-Din", role: "Economist" }
    ],
    image: "assets/bcc-15y.png",
    description: "Represented Bangladesh internationally, presenting digital trade corridors solutions to a panel of global executives."
  },
  {
    id: 11,
    title: "BUP Inter-Department Business Strategy Contest 2026",
    organizer: "BUP Business & Communication Club",
    year: "2026",
    rank: "Overall Champion",
    teamName: "BUP Nexus Consultants",
    members: [
      { name: "Zayan Mahmood", role: "Lead Consultant" },
      { name: "Tasnim Ferdous", role: "Market Analyst" }
    ],
    image: "assets/corporiddlerz-2025.jpg",
    description: "Won the flagship intra-university contest by formulating a turn-around plan for a struggling traditional retail chain."
  },
  {
    id: 12,
    title: "Corporate Leader of Tomorrow 2025",
    organizer: "L'Oréal Bangladesh",
    year: "2025",
    rank: "Best Leadership Award",
    teamName: "BUP Vanguard",
    members: [
      { name: "Arafat Hossain", role: "Corporate Communications" }
    ],
    image: "assets/unilever-learn-to-lead-2025.jpg",
    description: "Recognized for exceptional strategic leadership and crisis communications during simulated corporate restructuring scenarios."
  }
];
