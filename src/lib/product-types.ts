import type { FieldDef, ProductType } from "./categories";

/**
 * Built-in product types per category slug. Picking a product type in the
 * request builder shows its own measurements and details; fields marked
 * `ask: "both"` or `"donor"` are also asked of donors about what they give.
 */

const LENGTH = ["cm", "in"];
const LONG_LENGTH = ["m", "cm"];
const WEIGHT = ["kg", "g"];
const VOLUME = ["L", "ml"];

const measure = (key: string, label: string, units: string[], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "measure", units, ...extra });
const select = (key: string, label: string, options: string[], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "select", options, ...extra });
const text = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "text", ...extra });
const number = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "number", ...extra });
const yesNo = (key: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type: "boolean", ...extra });

const clothingSize = (extra: Partial<FieldDef> = {}) =>
  text("size", "Size", { required: true, ask: "both", placeholder: "e.g. M, L or 28, 30", help: "List every size you need, separated by commas.", ...extra });
const newOnly = select("condition", "Condition", ["New"], { help: "Only new items are accepted for hygiene reasons." });
const bedSize = select("bedSize", "Bed size", ["Single", "Double", "Queen", "King"], { required: true, ask: "both" });
const bestBefore = { key: "bestBefore", label: "Best before", type: "date", ask: "donor" } satisfies FieldDef;
const packWeight = measure("packSize", "Pack size", WEIGHT, { ask: "both", placeholder: "e.g. 5" });

export const DEFAULT_PRODUCT_TYPES: Record<string, ProductType[]> = {
  education: [
    {
      name: "School bag",
      fields: [
        number("compartments", "Compartments", { placeholder: "e.g. 2" }),
        measure("height", "Height", LENGTH, { ask: "both" }),
        select("material", "Material", ["Any", "Polyester", "Canvas", "Nylon"]),
        yesNo("waterproof", "Waterproof"),
      ],
    },
    {
      name: "Notebook",
      fields: [
        number("pages", "Pages", { required: true, ask: "both", placeholder: "e.g. 200" }),
        select("ruling", "Ruling", ["Ruled", "Unruled", "Four-line", "Two-line", "Square", "Graph"], { ask: "both" }),
        select("paperSize", "Paper size", ["A4", "A5", "Long (king size)", "Small (crown)"], { ask: "both" }),
      ],
    },
    {
      name: "Textbook / guide",
      fields: [
        select("grade", "Class / grade", ["LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "College"], { required: true, ask: "both" }),
        text("subject", "Subject", { placeholder: "e.g. Mathematics" }),
        select("syllabus", "Syllabus", ["State (SCERT)", "CBSE", "ICSE", "Other"], { ask: "both" }),
        select("language", "Language", ["English", "Malayalam", "Hindi", "Tamil", "Other"], { ask: "both" }),
      ],
    },
    { name: "Stationery kit", fields: [text("contents", "Contents", { required: true, placeholder: "e.g. 2 pens, pencil, eraser, scale" })] },
    { name: "Geometry box", fields: [text("contents", "Contents", { placeholder: "e.g. compass, protractor, set squares" })] },
    { name: "Calculator", fields: [select("calculatorType", "Calculator type", ["Basic", "Scientific"], { required: true, ask: "both" })] },
    {
      name: "Laptop / tablet",
      fields: [
        select("deviceType", "Device", ["Laptop", "Desktop", "Tablet"], { required: true, ask: "both" }),
        select("memory", "Minimum RAM", ["2 GB", "4 GB", "8 GB or more"], { ask: "both" }),
        measure("screenSize", "Screen size", ["in"], { ask: "both" }),
        text("purpose", "Used for", { placeholder: "e.g. online classes, typing practice" }),
      ],
    },
  ],

  clothing: [
    {
      name: "Shirt / T-shirt",
      fields: [
        clothingSize(),
        measure("chest", "Chest", LENGTH, { ask: "both" }),
        select("sleeve", "Sleeve", ["Any", "Half sleeve", "Full sleeve"]),
        select("fabric", "Fabric", ["Any", "Cotton", "Polyester", "Blend"]),
      ],
    },
    {
      name: "Trousers / shorts",
      fields: [
        clothingSize({ placeholder: "e.g. 28, 30" }),
        measure("waist", "Waist", LENGTH, { ask: "both" }),
        measure("length", "Length", LENGTH, { ask: "both" }),
      ],
    },
    {
      name: "School uniform",
      fields: [
        clothingSize(),
        text("setIncludes", "Set includes", { placeholder: "e.g. shirt + shorts / pinafore" }),
        text("colour", "Colour", { required: true, placeholder: "e.g. white shirt, navy shorts" }),
      ],
    },
    {
      name: "Dress / frock",
      fields: [clothingSize(), measure("length", "Length", LENGTH, { ask: "both" })],
    },
    {
      name: "Saree",
      hide: ["size", "ageGroup"],
      fields: [
        measure("length", "Length", LONG_LENGTH, { ask: "both", placeholder: "e.g. 5.5" }),
        select("fabric", "Fabric", ["Any", "Cotton", "Silk", "Synthetic"], { ask: "both" }),
        yesNo("blousePiece", "Blouse piece included", { ask: "both" }),
      ],
    },
    {
      name: "Mundu / dhoti",
      hide: ["size", "ageGroup"],
      fields: [
        select("style", "Style", ["Single mundu", "Double mundu", "Kasavu", "Lungi", "Any"]),
        measure("length", "Length", LONG_LENGTH, { ask: "both" }),
      ],
    },
    { name: "Innerwear", fields: [clothingSize(), newOnly] },
    {
      name: "Footwear",
      unit: "pairs",
      fields: [
        clothingSize({ label: "Shoe size (UK)", placeholder: "e.g. UK 4, UK 5" }),
        select("footwearType", "Type", ["School shoes", "Sports shoes", "Sandals", "Slippers", "Any"], { required: true, ask: "both" }),
      ],
    },
    {
      name: "Jacket / raincoat",
      fields: [
        clothingSize(),
        select("jacketType", "Type", ["Raincoat", "Rain jacket", "Sweater", "Winter jacket"], { ask: "both" }),
        yesNo("hooded", "Hooded"),
      ],
    },
    {
      name: "Blanket",
      hide: ["size", "ageGroup", "gender"],
      fields: [
        bedSize,
        select("material", "Material", ["Any", "Cotton", "Wool", "Fleece"], { ask: "both" }),
        measure("length", "Length", LENGTH, { ask: "donor" }),
        measure("width", "Width", LENGTH, { ask: "donor" }),
      ],
    },
  ],

  food: [
    {
      name: "Rice",
      hide: ["weight"],
      unit: "kg",
      fields: [select("variety", "Variety", ["Any", "Matta (red)", "Ponni", "Jaya", "Raw rice", "Basmati"], { ask: "both" }), packWeight, bestBefore],
    },
    { name: "Wheat flour / atta", hide: ["weight"], unit: "kg", fields: [packWeight, bestBefore] },
    {
      name: "Pulses / dal",
      hide: ["weight"],
      unit: "kg",
      fields: [select("pulse", "Pulse", ["Any", "Toor dal", "Moong dal", "Urad dal", "Chana", "Green gram"], { required: true, ask: "both" }), packWeight, bestBefore],
    },
    {
      name: "Cooking oil",
      hide: ["weight"],
      unit: "litres",
      fields: [
        select("oilType", "Oil", ["Any", "Coconut", "Sunflower", "Groundnut", "Palm"], { ask: "both" }),
        measure("packSize", "Pack size", VOLUME, { ask: "both", placeholder: "e.g. 1" }),
        bestBefore,
      ],
    },
    { name: "Sugar / salt", hide: ["weight"], unit: "kg", fields: [select("item", "Item", ["Sugar", "Salt", "Jaggery"], { required: true, ask: "both" }), packWeight, bestBefore] },
    {
      name: "Milk powder / baby formula",
      hide: ["weight"],
      unit: "packs",
      fields: [select("stage", "Stage", ["0–6 months", "6–12 months", "1–3 years", "Adult"], { required: true, ask: "both" }), packWeight, bestBefore],
    },
    { name: "Fruits & vegetables", hide: ["weight"], unit: "kg", fields: [text("items", "Which ones", { placeholder: "e.g. bananas, onions, potatoes" }), bestBefore] },
    { name: "Packaged snacks / biscuits", hide: ["weight"], unit: "packs", fields: [packWeight, bestBefore] },
    {
      name: "Cooked meals",
      unit: "meals",
      hide: ["weight", "packaging"],
      fields: [select("mealType", "Meal", ["Breakfast", "Lunch", "Dinner", "Any"], { required: true })],
    },
  ],

  children: [
    {
      name: "Toy",
      fields: [
        select("toyType", "Toy type", ["Any", "Building blocks", "Puzzle", "Soft toy", "Pretend play", "Musical", "Ride-on"], { ask: "both" }),
        yesNo("batteryOperated", "Battery operated", { ask: "both" }),
      ],
    },
    { name: "Board game / puzzle", fields: [number("pieces", "Pieces", { ask: "both" }), text("players", "Players", { placeholder: "e.g. 2–4" })] },
    {
      name: "Picture / story book",
      fields: [select("language", "Language", ["Any", "English", "Malayalam", "Hindi"], { ask: "both" }), number("pages", "Pages", { ask: "donor" })],
    },
    {
      name: "Bicycle",
      fields: [
        select("wheelSize", "Wheel size", ["12 inch", "14 inch", "16 inch", "20 inch", "24 inch", "26 inch"], { required: true, ask: "both" }),
        yesNo("gears", "Gears", { ask: "both" }),
        yesNo("trainingWheels", "Training wheels", { ask: "both" }),
      ],
    },
    {
      name: "Baby diapers",
      unit: "packs",
      hide: ["purpose", "safetyNotes"],
      fields: [select("size", "Size", ["NB", "S", "M", "L", "XL", "XXL"], { required: true, ask: "both" }), number("perPack", "Pieces per pack", { ask: "both" }), newOnly],
    },
    {
      name: "Stroller / cot / high chair",
      fields: [
        select("babyItem", "Item", ["Stroller", "Cot / crib", "High chair", "Baby carrier", "Bath tub"], { required: true, ask: "both" }),
        yesNo("foldable", "Foldable", { ask: "both" }),
      ],
    },
    { name: "Art & craft kit", fields: [text("contents", "Contents", { placeholder: "e.g. crayons, sketch pens, glue" })] },
  ],

  "elder-care": [
    {
      name: "Walking stick",
      hide: ["size"],
      fields: [
        select("tip", "Tip", ["Any", "Single tip", "Quad (4-leg)"], { ask: "both" }),
        yesNo("heightAdjustable", "Height adjustable", { ask: "both" }),
        measure("height", "Height", LENGTH, { ask: "donor" }),
      ],
    },
    {
      name: "Walker",
      hide: ["size"],
      fields: [
        select("wheels", "Wheels", ["Any", "No wheels", "2 wheels", "4 wheels (rollator)"], { ask: "both" }),
        yesNo("foldable", "Foldable", { ask: "both" }),
        measure("maxUserWeight", "Max user weight", WEIGHT, { ask: "both" }),
      ],
    },
    {
      name: "Wheelchair",
      hide: ["size"],
      fields: [
        select("wheelchairType", "Type", ["Self-propelled", "Attendant-pushed", "Any"], { ask: "both" }),
        measure("seatWidth", "Seat width", LENGTH, { required: true, ask: "both", placeholder: "e.g. 18" }),
        yesNo("foldable", "Foldable", { ask: "both" }),
        measure("maxUserWeight", "Max user weight", WEIGHT, { ask: "both" }),
      ],
    },
    {
      name: "Adult diapers",
      unit: "packs",
      fields: [select("size", "Size", ["M", "L", "XL"], { required: true, ask: "both" }), measure("waist", "Waist", LENGTH), number("perPack", "Pieces per pack", { ask: "both" }), newOnly],
    },
    {
      name: "Blanket / bedsheet",
      hide: ["size"],
      fields: [
        select("item", "Item", ["Blanket", "Bedsheet", "Bedsheet with pillow cover"], { required: true, ask: "both" }),
        bedSize,
        select("material", "Material", ["Any", "Cotton", "Wool", "Fleece"], { ask: "both" }),
      ],
    },
    {
      name: "Clothing",
      fields: [
        select("garment", "Garment", ["Nightwear", "Shirt", "Saree / blouse", "Mundu", "Cardigan / sweater"], { required: true, ask: "both" }),
        text("size", "Size", { required: true, ask: "both", placeholder: "e.g. M, L or 38, 40" }),
      ],
    },
    {
      name: "Reading glasses",
      hide: ["size"],
      fields: [select("power", "Power", ["+1.00", "+1.25", "+1.50", "+1.75", "+2.00", "+2.25", "+2.50", "+2.75", "+3.00"], { required: true, ask: "both" })],
    },
  ],

  "medical-support": [
    { name: "First-aid kit", fields: [text("contents", "Contents", { placeholder: "e.g. bandages, antiseptic, gauze" })] },
    {
      name: "Hygiene kit",
      fields: [select("kitFor", "Kit for", ["Any", "Women", "Men", "Children"], { ask: "both" }), text("contents", "Contents", { placeholder: "e.g. soap, toothbrush, towel" })],
    },
    {
      name: "Sanitary pads",
      unit: "packs",
      fields: [select("size", "Size", ["Regular", "Large / XL", "XXL"], { required: true, ask: "both" }), number("perPack", "Pads per pack", { ask: "both" })],
    },
    {
      name: "Crutches",
      unit: "pairs",
      fields: [
        select("crutchType", "Type", ["Underarm", "Elbow (forearm)"], { ask: "both" }),
        measure("userHeight", "User height", LENGTH, { required: true, placeholder: "e.g. 160" }),
        yesNo("adjustable", "Adjustable", { ask: "both" }),
      ],
    },
    {
      name: "Health monitor",
      fields: [select("device", "Device", ["BP monitor", "Glucometer", "Thermometer", "Pulse oximeter", "Nebuliser"], { required: true, ask: "both" })],
    },
    {
      name: "Hospital bed / air mattress",
      fields: [
        select("bedItem", "Item", ["Hospital bed (manual)", "Hospital bed (motorised)", "Air mattress"], { required: true, ask: "both" }),
        measure("length", "Length", LENGTH, { ask: "both" }),
        measure("width", "Width", LENGTH, { ask: "both" }),
      ],
    },
  ],

  household: [
    {
      name: "Chair",
      fields: [select("material", "Material", ["Any", "Plastic", "Wood", "Steel"], { ask: "both" }), measure("seatHeight", "Seat height", LENGTH, { ask: "both" }), yesNo("armrest", "Armrest", { ask: "both" })],
    },
    {
      name: "Table / desk",
      fields: [
        measure("length", "Length", LENGTH, { required: true, ask: "both" }),
        measure("width", "Width", LENGTH, { ask: "both" }),
        measure("height", "Height", LENGTH, { ask: "both" }),
        select("material", "Material", ["Any", "Wood", "Steel", "Plastic"], { ask: "both" }),
      ],
    },
    {
      name: "Cot / bed",
      fields: [bedSize, measure("length", "Length", LENGTH, { ask: "donor" }), measure("width", "Width", LENGTH, { ask: "donor" }), select("material", "Material", ["Any", "Wood", "Steel"], { ask: "both" })],
    },
    {
      name: "Mattress",
      fields: [bedSize, measure("thickness", "Thickness", LENGTH, { ask: "both", placeholder: "e.g. 4" }), select("material", "Material", ["Any", "Coir", "Foam", "Cotton", "Spring"], { ask: "both" })],
    },
    {
      name: "Cupboard / shelf",
      fields: [
        measure("height", "Height", LENGTH, { ask: "both" }),
        measure("width", "Width", LENGTH, { ask: "both" }),
        measure("depth", "Depth", LENGTH, { ask: "both" }),
        select("material", "Material", ["Any", "Steel", "Wood", "Plastic"], { ask: "both" }),
      ],
    },
    {
      name: "Cooking vessels",
      fields: [
        text("item", "Item", { required: true, placeholder: "e.g. 5 L pot, ladles, plates" }),
        select("material", "Material", ["Any", "Steel", "Aluminium", "Non-stick", "Cast iron"], { ask: "both" }),
        measure("capacity", "Capacity", VOLUME, { ask: "both" }),
      ],
    },
    {
      name: "Stove / cooker",
      fields: [
        select("cooker", "Item", ["Pressure cooker", "Gas stove (1 burner)", "Gas stove (2 burners)", "Induction cooktop", "Rice cooker"], { required: true, ask: "both" }),
        measure("capacity", "Capacity", VOLUME, { ask: "both" }),
      ],
    },
    { name: "Fan", fields: [select("fanType", "Fan type", ["Ceiling", "Table", "Pedestal", "Wall"], { required: true, ask: "both" }), measure("sweep", "Sweep / blade size", ["mm", "in"], { ask: "both" })] },
    {
      name: "Appliance",
      fields: [
        select("appliance", "Appliance", ["Refrigerator", "Mixer grinder", "Washing machine", "Iron box", "Water purifier", "Other"], { required: true, ask: "both" }),
        text("capacity", "Capacity / power", { ask: "both", placeholder: "e.g. 190 L, 750 W" }),
        measure("weight", "Weight", WEIGHT, { ask: "donor", help: "Helps us plan pickup." }),
      ],
    },
    { name: "Cleaning supplies", fields: [text("item", "Item", { required: true, placeholder: "e.g. floor cleaner, brooms" }), text("packSize", "Pack size", { ask: "both", placeholder: "e.g. 1 L, 500 g" })] },
  ],

  sports: [
    {
      name: "Ball",
      fields: [
        select("sport", "Sport", ["Football", "Volleyball", "Basketball", "Cricket (tennis ball)", "Cricket (leather)", "Throwball"], { required: true, ask: "both" }),
        select("size", "Ball size", ["Size 3", "Size 4", "Size 5", "Standard"], { ask: "both" }),
      ],
    },
    {
      name: "Cricket bat",
      fields: [
        select("size", "Bat size", ["Size 1", "Size 2", "Size 3", "Size 4", "Size 5", "Size 6", "Harrow", "Full size"], { required: true, ask: "both" }),
        select("willow", "Willow", ["Any", "Kashmir willow", "English willow", "Tennis-ball bat"], { ask: "both" }),
      ],
    },
    {
      name: "Sports shoes",
      unit: "pairs",
      fields: [text("size", "Shoe size (UK)", { required: true, ask: "both", placeholder: "e.g. UK 4, UK 5" }), select("sport", "For", ["Any", "Football (studs)", "Running", "Badminton", "Cricket"], { ask: "both" })],
    },
    { name: "Jersey / team kit", fields: [text("size", "Size", { required: true, ask: "both", placeholder: "e.g. S, M, L" }), text("setIncludes", "Set includes", { placeholder: "e.g. jersey + shorts + socks" })] },
    {
      name: "Protective gear",
      fields: [
        select("gear", "Gear", ["Shin guards", "Helmet", "Batting pads", "Gloves", "Knee pads"], { required: true, ask: "both" }),
        select("size", "Size", ["Small", "Medium", "Large"], { ask: "both" }),
      ],
    },
    {
      name: "Racket",
      fields: [select("sport", "Sport", ["Badminton", "Tennis", "Table tennis"], { required: true, ask: "both" }), yesNo("strung", "Strung", { ask: "both" })],
    },
    {
      name: "Net / goalpost",
      fields: [select("sport", "Sport", ["Football", "Volleyball", "Badminton", "Cricket practice"], { required: true, ask: "both" }), measure("length", "Length", LONG_LENGTH, { ask: "both" }), measure("width", "Width", LONG_LENGTH, { ask: "both" })],
    },
    { name: "Carrom / chess board", hide: ["size", "ageGroup"], fields: [select("game", "Game", ["Carrom", "Chess", "Ludo / snakes & ladders"], { required: true, ask: "both" }), measure("boardSize", "Board size", LENGTH, { ask: "both" })] },
  ],
};
