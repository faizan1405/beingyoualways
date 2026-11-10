// Verified business content — single source for every page/footer.
// Source: https://beingyoualways.com (checked Nov 2026). Swap for a Hostinger API later.

export const brandConfig = {
  name: "Being You – Always",
  tagline: "Naturally you, beautifully always.",
  business: "Plant-Based Skincare, Haircare & Colour Cosmetics",
  shortDescription:
    "Nature-inspired skincare, haircare and colour cosmetics for everyday rituals that feel thoughtful, enjoyable and personal.",
  originalWebsite: "https://beingyoualways.com/",
} as const;

export const contactConfig = {
  phones: [
    { label: "Primary", display: "+91 97374 22248", tel: "+919737422248" },
    { label: "Secondary", display: "+91 97278 59248", tel: "+919727859248" },
  ],
  email: "info@beingyoualways.com",
  addressLines: [
    "219, Ved Arcade, Opposite Vastral Lake",
    "200 Ft Sardar Patel Ring Road, Near Metro Station",
    "Vastral, Ahmedabad, Gujarat – 382418, India",
  ],
  // Not set until the client confirms which number is on WhatsApp.
  whatsappNumber: null as string | null,
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/beingyoualwaysindia/" },
    { label: "Facebook", href: "https://www.facebook.com/beingyoualwaysindia/" },
  ],
} as const;

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "219 Ved Arcade, Opposite Vastral Lake, Sardar Patel Ring Road, Vastral, Ahmedabad, Gujarat 382418",
)}`;

export const founderContent = {
  names: "Priyanka & Anirudhh Rajput",
  title: "Co-Founders, Being You Always",
  quote:
    "From our 9-year-old daughter to our 64-year-old mother, our family trusts many Being You Always products every day. That trust is our biggest responsibility. If we wouldn't choose it for our own family, we wouldn't create it for yours.",
} as const;

export const aboutContent = {
  heading: "Beauty begins with being you.",
  story: [
    "At Being You – Always, we believe beauty isn't about becoming someone else. It's about feeling confident, comfortable, and authentically yourself.",
    "Inspired by nature, our skincare, haircare, and colour cosmetics are designed to make everyday beauty rituals feel thoughtful, enjoyable, and personal.",
    "We believe self-care should be more than a routine. It should be a moment to reconnect with yourself, celebrate your individuality, and embrace your natural beauty.",
  ],
  signoff: "Being You – Always. Naturally you, beautifully always.",
  mission:
    "To make thoughtful, nature-inspired beauty accessible while empowering people to embrace their individuality with confidence.",
  vision:
    "To create a beauty experience that celebrates self-expression, conscious care, and the belief that everyone deserves to feel beautiful in their own skin.",
  copyStatus: "Draft copy approved for design — final wording pending client approval.",
} as const;

export const navigationConfig = {
  shop: [
    { to: "/skincare", label: "Skin Care" },
    { to: "/haircare", label: "Hair Care" },
    { to: "/de-tan-care", label: "De-Tan Care" },
    { to: "/colour-cosmetics", label: "Colour Cosmetics" },
    { to: "/combos", label: "Combos" },
  ],
  information: [
    { to: "/explore-concerns", label: "Explore by Concern" },
    { to: "/about", label: "About Us" },
    { to: "/contact", label: "Contact Us" },
    { to: "/faq", label: "FAQs" },
  ],
} as const;

export const policyLinks = [
  { to: "/shipping-policy", label: "Shipping Policy" },
  { to: "/refund-policy", label: "Refund & Returns" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/disclaimer", label: "Disclaimer" },
] as const;

// Shipping charges are not confirmed by the client — keep false until approved.
export const SHIPPING_RATES_CONFIRMED = false;

// Cash on Delivery availability, limits and charges are not confirmed — keep false until approved.
export const COD_RULES_CONFIRMED = false;

// Product stock is demo data until the client's real inventory is connected.
export const INVENTORY_CONNECTED = false;

// "What We Stand For" and "Global Standards" are restored word-for-word from beingyoualways.com.
// They contain formulation, suitability, animal-testing and sourcing claims that have NOT been
// independently verified — keep false until the client confirms them in writing.
export const BRAND_CLAIMS_CONFIRMED = false;

export const claimsSource = { url: "https://beingyoualways.com/", checkedOn: "2026-11-10" } as const;

/** Original "What We Stand For" cards — headings and descriptions copied exactly. */
export const standForContent = {
  heading: "What We Stand For",
  items: [
    {
      title: "Paraben Free",
      text: "We source the finest ingredients and adhere to the highest standards to deliver products that are effective, safe, and luxurious.",
    },
    {
      title: "Natural",
      text: "Our formulas are inspired by nature and free from harsh chemicals, making them suitable for all skin types, including sensitive skin.",
    },
    {
      title: "Cruelty-Free",
      text: "We are committed to ethical practices, ensuring that our products are never tested on animals and are packaged with eco-conscious materials.",
    },
  ],
} as const;

/** Original "Global Standards" section — heading and the six countries shown on the old site. */
export const globalStandardsContent = {
  heading: "Global Standards for Importing Cosmetic Ingredients",
  countries: [
    { code: "IN", name: "India" },
    { code: "KR", name: "South Korea" },
    { code: "ES", name: "Spain" },
    { code: "BR", name: "Brazil" },
    { code: "DE", name: "Germany" },
    { code: "US", name: "United States" },
  ],
} as const;
