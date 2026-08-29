import type {
  AppNotification,
  AuditEvent,
  ClassificationNode,
  Cpse,
  DuplicateCluster,
  GovernanceIssue,
  Integration,
  Mapping,
  Material,
  MatchType,
  MigrationBatch,
  NationalCode,
  TrendPoint,
} from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random source (stable across reloads)          */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260826);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pad = (n: number, w = 5) => String(n).padStart(w, "0");

const DAY = 86_400_000;
const NOW = new Date("2026-08-26T14:32:00Z").getTime();
const daysAgo = (d: number, h = 0) => new Date(NOW - d * DAY - h * 3_600_000).toISOString();

/* ------------------------------------------------------------------ */
/* CPSEs                                                               */
/* ------------------------------------------------------------------ */
export const CPSES: Cpse[] = [
  { id: "ONGC", name: "Oil & Natural Gas Corporation", shortName: "ONGC", sector: "Oil & Gas", erp: "SAP S/4HANA", region: "Western" },
  { id: "IOCL", name: "Indian Oil Corporation Ltd", shortName: "IOCL", sector: "Refining", erp: "SAP ECC 6.0", region: "Northern" },
  { id: "BPCL", name: "Bharat Petroleum Corporation Ltd", shortName: "BPCL", sector: "Refining", erp: "SAP S/4HANA", region: "Western" },
  { id: "HPCL", name: "Hindustan Petroleum Corporation Ltd", shortName: "HPCL", sector: "Refining", erp: "SAP ECC 6.0", region: "Southern" },
  { id: "GAIL", name: "GAIL (India) Limited", shortName: "GAIL", sector: "Gas Transmission", erp: "SAP S/4HANA", region: "Northern" },
  { id: "NTPC", name: "NTPC Limited", shortName: "NTPC", sector: "Power Generation", erp: "SAP ECC 6.0", region: "Northern" },
  { id: "PGCIL", name: "Power Grid Corporation of India", shortName: "POWERGRID", sector: "Transmission", erp: "SAP S/4HANA", region: "Northern" },
  { id: "SAIL", name: "Steel Authority of India Ltd", shortName: "SAIL", sector: "Steel", erp: "SAP ECC 6.0", region: "Eastern" },
  { id: "BHEL", name: "Bharat Heavy Electricals Ltd", shortName: "BHEL", sector: "Heavy Engineering", erp: "Oracle EBS", region: "Southern" },
  { id: "CIL", name: "Coal India Limited", shortName: "Coal India", sector: "Mining", erp: "SAP ECC 6.0", region: "Eastern" },
  { id: "NMDC", name: "NMDC Limited", shortName: "NMDC", sector: "Mining", erp: "Oracle EBS", region: "Southern" },
  { id: "HAL", name: "Hindustan Aeronautics Ltd", shortName: "HAL", sector: "Aerospace", erp: "SAP S/4HANA", region: "Southern" },
];

export const USERS = [
  { name: "Rajesh Kumar", role: "Material Master Governance Officer" },
  { name: "Ananya Sharma", role: "National Administrator" },
  { name: "Vikram Iyer", role: "Material Engineer" },
  { name: "Sunita Deshmukh", role: "Procurement Officer" },
  { name: "Farhan Qureshi", role: "Reviewer" },
  { name: "Meera Nair", role: "Auditor" },
];

export const ROLES = [
  "National Administrator",
  "CPSE Administrator",
  "Material Engineer",
  "Procurement Officer",
  "Reviewer",
  "Auditor",
] as const;

/* ------------------------------------------------------------------ */
/* Material families — realistic Indian industrial procurement items    */
/* ------------------------------------------------------------------ */
interface Family {
  key: string;
  category: string;
  subCategory: string;
  path: string[];
  uom: string;
  altUoms: string[];
  brands: string[];
  sizes: string[];
  std: (size: string) => string;
  raw: ((size: string, brand: string) => string)[];
  attrs: (size: string, brand: string) => Record<string, string>;
  spec: (size: string) => string;
  rate: [number, number];
}

const FAMILIES: Family[] = [
  {
    key: "BRG",
    category: "Bearings",
    subCategory: "Ball Bearings",
    path: ["Mechanical Components", "Bearings", "Ball Bearings", "Deep Groove Ball Bearings"],
    uom: "EA",
    altUoms: ["NOS", "NO", "PC"],
    brands: ["SKF", "FAG", "NBC", "TIMKEN", "NTN"],
    sizes: ["6205 ZZ C3", "6206 2RS C3", "6308 ZZ", "6310 C3", "6004 2RS", "6207 ZZ C3", "22217 E", "NU 220 E"],
    std: (s) => `DEEP GROOVE BALL BEARING ${s}`,
    raw: [
      (s, b) => `BALL BRG ${s.replace("ZZ", "ZZ")} ${b}`,
      (s) => `DEEP GROOVE BALL BEARING ${s.replace("ZZ", "2Z")}`,
      (s) => `BALL BEARING ${s}`,
      (s, b) => `BRG,BALL,${s},MAKE ${b}`,
      (s) => `BEARING BALL ${s} IS:9963`,
    ],
    attrs: (s, b) => ({
      "Bearing Type": "Deep Groove Ball Bearing",
      Designation: s.split(" ")[0]!,
      "Bore Diameter": `${int(20, 60)} mm`,
      "Outer Diameter": `${int(47, 110)} mm`,
      Width: `${int(12, 27)} mm`,
      "Seal Type": s.includes("2RS") ? "Rubber sealed (2RS)" : "Metal shielded (ZZ)",
      Clearance: s.includes("C3") ? "C3" : "Normal",
      "Cage Material": "Pressed steel",
      Standard: "IS 2898 / ISO 15",
      Manufacturer: b,
    }),
    spec: (s) => `Chrome steel, ${s}, ABEC-1`,
    rate: [380, 4200],
  },
  {
    key: "VLV",
    category: "Valves",
    subCategory: "Gate Valves",
    path: ["Mechanical Components", "Valves", "Isolation Valves", "Gate Valves"],
    uom: "EA",
    altUoms: ["NOS", "NO"],
    brands: ["KSB", "L&T Valves", "BDK", "Kirloskar", "Audco"],
    sizes: ['2" 150#', '4" 300#', '6" 150#', '8" 300#', '10" 150#', '3" 600#'],
    std: (s) => `GATE VALVE ${s} FLANGED CS BODY SS TRIM`,
    raw: [
      (s) => `GT VLV ${s} FLG CS`,
      (s, b) => `VALVE GATE ${s} CARBON STEEL ${b}`,
      (s) => `GATE VALVE,${s},FLANGED END,ASTM A216 WCB`,
      (s) => `VLV-GATE-${s.replace(/["#\s]/g, "")}-CS`,
    ],
    attrs: (s, b) => ({
      "Valve Type": "Gate Valve",
      "Nominal Size": s.split(" ")[0]!,
      "Pressure Class": s.split(" ")[1] ?? "150#",
      "Body Material": "ASTM A216 Gr WCB",
      "Trim Material": "SS 410",
      "End Connection": "Flanged RF",
      "Operating Temp": "-29 to 425 degC",
      Standard: "API 600 / ASME B16.34",
      Manufacturer: b,
    }),
    spec: (s) => `Cast carbon steel body, ${s}, API 600`,
    rate: [8500, 148000],
  },
  {
    key: "PMP",
    category: "Pumps",
    subCategory: "Centrifugal Pumps",
    path: ["Rotating Equipment", "Pumps", "Centrifugal Pumps", "Horizontal Process Pumps"],
    uom: "EA",
    altUoms: ["NOS", "SET"],
    brands: ["KSB", "Kirloskar", "Flowserve", "Sulzer", "WPIL"],
    sizes: ["50x32-160", "80x65-200", "100x80-250", "65x40-200", "125x100-315"],
    std: (s) => `CENTRIFUGAL PUMP HORIZONTAL ${s} API 610`,
    raw: [
      (s) => `CENTF PUMP ${s} HORZ`,
      (s, b) => `PUMP CENTRIFUGAL ${s} ${b} API610`,
      (s) => `PUMP,CENTRIFUGAL,HORIZONTAL,${s}`,
      (s) => `CF PUMP ASSY ${s} W/ BASE PLATE`,
    ],
    attrs: (s, b) => ({
      "Pump Type": "Horizontal centrifugal, back pull-out",
      Frame: s,
      "Rated Flow": `${int(20, 320)} m3/hr`,
      "Rated Head": `${int(18, 120)} m`,
      "Casing Material": "CF8M",
      "Impeller Material": "SS 316",
      "Seal Type": "Mechanical seal, API 682 Cat-2",
      Standard: "API 610 11th Ed.",
      Manufacturer: b,
    }),
    spec: (s) => `Frame ${s}, API 610 OH2`,
    rate: [145000, 1250000],
  },
  {
    key: "MOT",
    category: "Motors",
    subCategory: "Induction Motors",
    path: ["Electrical Equipment", "Rotating Machines", "Induction Motors", "Squirrel Cage Motors"],
    uom: "EA",
    altUoms: ["NOS", "NO"],
    brands: ["ABB", "Siemens", "Crompton", "BHEL", "Havells"],
    sizes: ["15 KW 1500 RPM", "30 KW 1500 RPM", "55 KW 1500 RPM", "7.5 KW 3000 RPM", "90 KW 1000 RPM"],
    std: (s) => `AC INDUCTION MOTOR SQUIRREL CAGE ${s} 415V IE3`,
    raw: [
      (s) => `MOTOR AC ${s} TEFC`,
      (s, b) => `IND MOTOR ${s.replace(" KW", "KW")} 415V ${b}`,
      (s) => `ELECT MOTOR,3 PH,${s},IE3`,
      (s) => `MOTOR SQ CAGE ${s} FLP`,
    ],
    attrs: (s, b) => ({
      "Machine Type": "3-phase squirrel cage induction motor",
      Rating: s.split(" KW")[0] + " kW",
      Speed: s.includes("1500") ? "1500 rpm (4 pole)" : s.includes("3000") ? "3000 rpm (2 pole)" : "1000 rpm (6 pole)",
      Voltage: "415 V +/- 10%",
      Enclosure: "TEFC IP55",
      "Efficiency Class": "IE3",
      "Insulation Class": "Class F, Temp rise B",
      Standard: "IS 12615 / IEC 60034",
      Manufacturer: b,
    }),
    spec: (s) => `${s}, 415V, IP55, IE3`,
    rate: [42000, 690000],
  },
  {
    key: "CBL",
    category: "Cables",
    subCategory: "Power Cables",
    path: ["Electrical Equipment", "Cables & Conductors", "LT Power Cables", "XLPE Armoured Cables"],
    uom: "M",
    altUoms: ["MTR", "RMT", "KM"],
    brands: ["Polycab", "Havells", "KEI", "Finolex", "RR Kabel"],
    sizes: ["3C x 95 SQMM", "3.5C x 185 SQMM", "4C x 16 SQMM", "1C x 630 SQMM", "3C x 25 SQMM"],
    std: (s) => `POWER CABLE XLPE ARMOURED ${s} 1.1KV AL CONDUCTOR`,
    raw: [
      (s) => `CABLE XLPE ${s} 1.1 KV ARM`,
      (s, b) => `PWR CBL ${s.replace("SQMM", "SQ MM")} AL ARMD ${b}`,
      (s) => `CABLE,POWER,ALUMINIUM,${s},1100V`,
      (s) => `LT CABLE ${s} XLPE/PVC ARMOURED`,
    ],
    attrs: (s, b) => ({
      "Cable Type": "XLPE insulated, PVC sheathed, armoured",
      Configuration: s,
      Conductor: "Aluminium, stranded",
      Voltage: "1.1 kV grade",
      Armour: "Galvanised steel strip",
      "Sheath Colour": "Black",
      Standard: "IS 7098 Part-1",
      Manufacturer: b,
    }),
    spec: (s) => `${s} AL XLPE armoured, IS 7098`,
    rate: [280, 3400],
  },
  {
    key: "PIP",
    category: "Pipes & Fittings",
    subCategory: "Seamless Pipes",
    path: ["Piping", "Pipes", "Carbon Steel Pipes", "Seamless Pipes"],
    uom: "M",
    altUoms: ["MTR", "RMT"],
    brands: ["Jindal", "MSL", "ISMT", "Welspun"],
    sizes: ['6" SCH40', '4" SCH80', '8" SCH40', '2" SCH80', '12" SCH40'],
    std: (s) => `PIPE SEAMLESS CARBON STEEL ${s} ASTM A106 GR B`,
    raw: [
      (s) => `PIPE CS SMLS ${s} A106 GRB`,
      (s) => `SEAMLESS PIPE ${s} ASTM A 106 GR.B`,
      (s) => `PIPE,CS,${s.replace("SCH", "SCHEDULE ")},SMLS`,
      (s) => `CS PIPE ${s} BEVELLED END`,
    ],
    attrs: (s) => ({
      "Product Form": "Seamless pipe",
      "Nominal Bore": s.split(" ")[0]!,
      Schedule: s.split(" ")[1] ?? "SCH40",
      Material: "ASTM A106 Gr B",
      "End Preparation": "Bevelled end 37.5 deg",
      "Test Requirement": "Hydro + UT",
      Standard: "ASME B36.10M",
    }),
    spec: (s) => `A106 Gr B, ${s}`,
    rate: [860, 7400],
  },
  {
    key: "FST",
    category: "Fasteners",
    subCategory: "Bolts",
    path: ["Mechanical Components", "Fasteners", "Bolts & Studs", "Hex Head Bolts"],
    uom: "EA",
    altUoms: ["NOS", "KG", "PC"],
    brands: ["Unbrako", "TVS", "Sundram", "APL"],
    sizes: ["M16 X 60", "M20 X 80", "M12 X 50", "M24 X 100", "M10 X 40"],
    std: (s) => `HEX HEAD BOLT ${s} GR 8.8 HDG`,
    raw: [
      (s) => `HEX BOLT ${s} 8.8 GALV`,
      (s) => `BOLT HEXAGON HEAD ${s.replace(" X ", "X")} GRADE 8.8`,
      (s) => `BOLT,HEX,${s},HOT DIP GALVANISED`,
      (s) => `HH BOLT ${s} CL 8.8 W/ NUT`,
    ],
    attrs: (s) => ({
      "Fastener Type": "Hexagon head bolt",
      Size: s,
      "Property Class": "8.8",
      "Thread Type": "Metric coarse ISO 261",
      Finish: "Hot dip galvanised",
      Standard: "IS 1364 / ISO 4014",
    }),
    spec: (s) => `${s}, class 8.8, HDG`,
    rate: [18, 240],
  },
  {
    key: "INS",
    category: "Instrumentation",
    subCategory: "Pressure Gauges",
    path: ["Instrumentation", "Field Instruments", "Pressure Instruments", "Bourdon Pressure Gauges"],
    uom: "EA",
    altUoms: ["NOS", "NO"],
    brands: ["Wika", "H Guru", "Forbes Marshall", "Baumer"],
    sizes: ["0-10 KG/CM2 100MM", "0-25 BAR 150MM", "0-40 KG/CM2 100MM", "0-4 BAR 63MM"],
    std: (s) => `PRESSURE GAUGE BOURDON TYPE ${s} SS316 GLYCERINE FILLED`,
    raw: [
      (s) => `PR GAUGE ${s} SS`,
      (s, b) => `PRESSURE GAUGE ${s} ${b} GLYC FILLED`,
      (s) => `GAUGE,PRESSURE,BOURDON,${s}`,
      (s) => `PG ${s} 1/2 NPT BOTTOM ENTRY`,
    ],
    attrs: (s, b) => ({
      "Instrument Type": "Bourdon tube pressure gauge",
      Range: s.split(" ").slice(0, 2).join(" "),
      "Dial Size": s.split(" ").slice(-1)[0]!,
      "Wetted Parts": "SS 316",
      "Process Connection": '1/2" NPT (M) bottom',
      Accuracy: "+/- 1.0% FSD",
      Filling: "Glycerine",
      Standard: "EN 837-1",
      Manufacturer: b,
    }),
    spec: (s) => `Bourdon, ${s}, SS316`,
    rate: [1450, 12800],
  },
  {
    key: "LUB",
    category: "Lubricants",
    subCategory: "Industrial Oils",
    path: ["Consumables", "Lubricants", "Industrial Oils", "Turbine & Gear Oils"],
    uom: "L",
    altUoms: ["LTR", "DRUM", "KG"],
    brands: ["Servo", "HP", "Shell", "Castrol"],
    sizes: ["ISO VG 46", "ISO VG 68", "ISO VG 320", "ISO VG 150"],
    std: (s) => `INDUSTRIAL GEAR OIL ${s} MINERAL BASE`,
    raw: [
      (s) => `GEAR OIL ${s}`,
      (s, b) => `LUB OIL ${s} ${b} 210 LTR DRUM`,
      (s) => `OIL,GEAR,INDUSTRIAL,${s}`,
      (s) => `EP GEAR OIL ${s.replace("ISO ", "")}`,
    ],
    attrs: (s, b) => ({
      "Product Type": "Extreme pressure industrial gear oil",
      "Viscosity Grade": s,
      "Base Oil": "Mineral, Group II",
      "Flash Point": "> 220 degC",
      "Pack Size": "210 L drum",
      Standard: "IS 8406 / DIN 51517-3",
      Manufacturer: b,
    }),
    spec: (s) => `${s}, EP additive`,
    rate: [180, 460],
  },
  {
    key: "ELC",
    category: "Electrical Components",
    subCategory: "Contactors",
    path: ["Electrical Equipment", "Switchgear", "LT Switchgear", "Power Contactors"],
    uom: "EA",
    altUoms: ["NOS", "NO"],
    brands: ["Schneider", "Siemens", "L&T", "ABB"],
    sizes: ["40A 3P 240VAC", "95A 3P 415VAC", "25A 3P 240VAC", "150A 3P 415VAC"],
    std: (s) => `POWER CONTACTOR ${s} AC-3 DUTY`,
    raw: [
      (s) => `CONTACTOR ${s}`,
      (s, b) => `PWR CONTACTOR ${s.replace(" 3P", " TP")} ${b}`,
      (s) => `CONTACTOR,POWER,${s},AC3`,
      (s) => `MAG CONTACTOR ${s} W/ 2NO+2NC`,
    ],
    attrs: (s, b) => ({
      "Device Type": "Electromagnetic power contactor",
      "Rated Current": s.split(" ")[0]!,
      Poles: "3 pole",
      "Coil Voltage": s.includes("415") ? "415 V AC" : "240 V AC",
      "Utilisation Category": "AC-3",
      "Auxiliary Contacts": "2 NO + 2 NC",
      Standard: "IS/IEC 60947-4-1",
      Manufacturer: b,
    }),
    spec: (s) => `AC-3, ${s}`,
    rate: [2200, 28000],
  },
];

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */
const REVIEWERS = ["Vikram Iyer", "Farhan Qureshi", "Ananya Sharma", "Sunita Deshmukh"];

export interface Dataset {
  materials: Material[];
  clusters: DuplicateCluster[];
  nationalCodes: NationalCode[];
  mappings: Mapping[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  integrations: Integration[];
  governance: GovernanceIssue[];
  classification: ClassificationNode[];
  trend: TrendPoint[];
  migrations: MigrationBatch[];
  baseline: {
    totalMaterials: number;
    standardized: number;
    duplicateCandidates: number;
    pendingReview: number;
    mappedToNational: number;
    legacyCodes: number;
    rationalisationValue: number;
  };
}

function buildDataset(): Dataset {
  const materials: Material[] = [];
  const clusters: DuplicateCluster[] = [];
  const nationalCodes: NationalCode[] = [];
  const mappings: Mapping[] = [];
  const audit: AuditEvent[] = [];
  const governance: GovernanceIssue[] = [];

  let matSeq = 1;
  let clusterSeq = 4801;
  let nationalSeq = 101;

  const matchTypes: MatchType[] = [
    "exact-match",
    "near-duplicate",
    "near-duplicate",
    "functional-equivalent",
    "potential-conflict",
  ];

  FAMILIES.forEach((fam) => {
    fam.sizes.forEach((size, sizeIdx) => {
      // Each (family,size) is a "concept" instantiated by several CPSEs.
      const variantCount = int(2, 5);
      const cpsePool = [...CPSES].sort(() => rnd() - 0.5).slice(0, variantCount);
      const conceptMaterials: Material[] = [];

      cpsePool.forEach((cpse, vIdx) => {
        const brand = pick(fam.brands);
        const rawFn = fam.raw[(vIdx + sizeIdx) % fam.raw.length]!;
        const uom = vIdx === 0 ? fam.uom : pick([fam.uom, ...fam.altUoms]);
        const codeStyles = [
          `MAT-${pad(100000 + matSeq * 7, 6)}`,
          `${fam.key}-${size.replace(/[^A-Z0-9]/gi, "").slice(0, 6)}-${int(100, 999)}`,
          `M-${pad(40000 + matSeq * 13, 5)}`,
          `${cpse.id}/${fam.key}/${pad(matSeq * 3, 4)}`,
        ];
        const mat: Material = {
          id: `MTL-${pad(matSeq, 5)}`,
          cpseId: cpse.id,
          cpseCode: codeStyles[(vIdx + sizeIdx) % codeStyles.length]!,
          description: rawFn(size, brand),
          standardDescription: null,
          category: fam.category,
          subCategory: fam.subCategory,
          classificationPath: fam.path,
          specification: fam.spec(size),
          uom,
          status: "unstandardized",
          approvalStatus: "not-submitted",
          confidence: null,
          nationalCode: null,
          clusterId: null,
          attributes: fam.attrs(size, brand),
          manufacturer: brand,
          unitRate: int(fam.rate[0], fam.rate[1]),
          stockQty: int(0, 480),
          dataQuality: int(58, 99),
          lastUpdated: daysAgo(int(0, 220), int(0, 20)),
          source: `${cpse.erp} · MM Master`,
          lifecycle: "Active",
          version: `v${int(1, 4)}.${int(0, 9)}`,
        };
        materials.push(mat);
        conceptMaterials.push(mat);
        matSeq += 1;
      });

      if (conceptMaterials.length < 2) return;

      const matchType =
        conceptMaterials.length >= 3 ? matchTypes[sizeIdx % matchTypes.length]! : pick(matchTypes);
      const baseSim =
        matchType === "exact-match"
          ? int(970, 995) / 10
          : matchType === "near-duplicate"
            ? int(910, 969) / 10
            : matchType === "functional-equivalent"
              ? int(830, 909) / 10
              : int(690, 829) / 10;

      const nationalCode = `NUMM-${fam.key}-${size.replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase()}-${pad(nationalSeq, 5)}`;
      const clusterId = `DUP-${clusterSeq}`;
      const stdDesc = fam.std(size);

      const rolled = rnd();
      const status: DuplicateCluster["status"] =
        rolled < 0.28 ? "approved" : rolled < 0.5 ? "under-review" : rolled < 0.82 ? "recommended" : "detected";

      const cluster: DuplicateCluster = {
        id: clusterId,
        category: fam.category,
        memberIds: conceptMaterials.map((m) => m.id),
        similarity: baseSim,
        descriptionSimilarity: Math.min(99.4, baseSim + int(-40, 30) / 10),
        specificationSimilarity: Math.min(99.6, baseSim + int(-20, 40) / 10),
        attributeOverlap: Math.min(100, baseSim + int(-60, 20) / 10),
        uomCompatible: new Set(conceptMaterials.map((m) => m.uom)).size <= 2,
        classificationSimilarity: matchType === "potential-conflict" ? int(700, 880) / 10 : int(920, 1000) / 10,
        matchType,
        status,
        recommendation: {
          nationalCode,
          standardDescription: stdDesc,
          category: fam.category,
          uom: fam.uom,
          confidence: baseSim,
          rationale: [
            `Normalised description tokens match on ${int(6, 11)} of ${int(9, 13)} significant terms`,
            `Key technical attributes identical: ${Object.keys(conceptMaterials[0]!.attributes).slice(0, 3).join(", ")}`,
            cluster_uomNote(conceptMaterials.map((m) => m.uom)),
            matchType === "potential-conflict"
              ? "Attribute divergence detected — engineering confirmation required"
              : "Classification path consistent across all member records",
          ],
        },
        detectedOn: daysAgo(int(1, 90), int(0, 22)),
        reviewer: status === "detected" ? null : pick(REVIEWERS),
        slaDays: int(2, 14),
        comments:
          status === "detected"
            ? []
            : [
                {
                  id: `CMT-${clusterSeq}-1`,
                  author: pick(REVIEWERS),
                  role: "Material Engineer",
                  timestamp: daysAgo(int(1, 40), int(0, 20)),
                  body: `Verified dimensional attributes against ${conceptMaterials[0]!.attributes["Standard"] ?? "vendor datasheet"}. Specification set is consistent.`,
                  kind: "comment",
                },
              ],
      };
      clusters.push(cluster);

      conceptMaterials.forEach((m) => {
        m.clusterId = clusterId;
        m.confidence = Math.round((baseSim + int(-25, 15) / 10) * 10) / 10;
        if (status === "approved") {
          m.status = "mapped";
          m.approvalStatus = "approved";
          m.standardDescription = stdDesc;
          m.nationalCode = nationalCode;
          m.uom = fam.uom;
          mappings.push({
            id: `MAP-${pad(mappings.length + 1, 5)}`,
            nationalCode,
            cpseId: m.cpseId,
            cpseCode: m.cpseCode,
            materialId: m.id,
            status: "active",
            mappedOn: daysAgo(int(1, 70)),
            approvedBy: cluster.reviewer,
          });
        } else if (status === "under-review") {
          m.status = "under-review";
          m.approvalStatus = "pending";
          m.standardDescription = stdDesc;
        } else if (status === "recommended") {
          m.status = "duplicate-candidate";
        }
      });

      if (status === "approved") {
        nationalCodes.push({
          id: `NC-${pad(nationalSeq, 5)}`,
          code: nationalCode,
          standardDescription: stdDesc,
          category: fam.category,
          uom: fam.uom,
          status: "active",
          mappedCpses: conceptMaterials.map((m) => m.cpseId),
          mappedLegacyCodes: conceptMaterials.length,
          approvedOn: daysAgo(int(1, 70)),
          approvedBy: cluster.reviewer,
          clusterId,
        });
        audit.push({
          id: `AUD-${pad(audit.length + 1, 5)}`,
          timestamp: daysAgo(int(1, 70), int(0, 23)),
          user: cluster.reviewer ?? "Ananya Sharma",
          role: "Reviewer",
          action: "Approved harmonisation recommendation",
          entity: clusterId,
          previousValue: "Recommended",
          newValue: `${nationalCode} · Approved`,
          reason: "Specification equivalence confirmed",
          status: "success",
        });
      } else if (status === "under-review") {
        nationalCodes.push({
          id: `NC-${pad(nationalSeq, 5)}`,
          code: nationalCode,
          standardDescription: stdDesc,
          category: fam.category,
          uom: fam.uom,
          status: "pending-approval",
          mappedCpses: [],
          mappedLegacyCodes: 0,
          approvedOn: null,
          approvedBy: null,
          clusterId,
        });
      }

      if (matchType === "potential-conflict" || rnd() < 0.25) {
        governance.push({
          id: `GOV-${pad(governance.length + 1, 4)}`,
          type: pick([
            "UOM Inconsistency",
            "Missing Specification",
            "Classification Exception",
            "Unresolved Conflict",
            "Policy Violation",
            "Data Quality Issue",
          ]),
          severity:
            matchType === "potential-conflict"
              ? pick(["critical", "high"] as const)
              : pick(["high", "medium", "low", "medium"] as const),
          entity: clusterId,
          cpseId: pick(conceptMaterials).cpseId,
          detail: !cluster.uomCompatible
            ? `Member records use incompatible units (${[...new Set(conceptMaterials.map((m) => m.uom))].join(", ")}) — conversion factor required before mapping.`
            : `${fam.category}: attribute set incomplete for ${conceptMaterials.length} member records; ${pick(Object.keys(conceptMaterials[0]!.attributes))} not populated at source.`,
          raisedOn: daysAgo(int(0, 60)),
          status: pick(["open", "open", "acknowledged", "resolved"] as const),
          owner: pick(REVIEWERS),
        });
      }

      clusterSeq += int(2, 9);
      nationalSeq += 1;
    });
  });

  /* Unclustered singleton records for realism */
  for (let i = 0; i < 60; i += 1) {
    const fam = pick(FAMILIES);
    const size = pick(fam.sizes);
    const brand = pick(fam.brands);
    const cpse = pick(CPSES);
    materials.push({
      id: `MTL-${pad(matSeq, 5)}`,
      cpseId: cpse.id,
      cpseCode: `MAT-${pad(200000 + matSeq * 11, 6)}`,
      description: fam.raw[i % fam.raw.length]!(size, brand),
      standardDescription: rnd() < 0.4 ? fam.std(size) : null,
      category: fam.category,
      subCategory: fam.subCategory,
      classificationPath: fam.path,
      specification: fam.spec(size),
      uom: pick([fam.uom, ...fam.altUoms]),
      status: rnd() < 0.4 ? "standardized" : "unstandardized",
      approvalStatus: "not-submitted",
      confidence: null,
      nationalCode: null,
      clusterId: null,
      attributes: fam.attrs(size, brand),
      manufacturer: brand,
      unitRate: int(fam.rate[0], fam.rate[1]),
      stockQty: int(0, 300),
      dataQuality: int(45, 92),
      lastUpdated: daysAgo(int(0, 320)),
      source: `${cpse.erp} · MM Master`,
      lifecycle: pick(["Active", "Active", "Legacy", "Under Revision"] as const),
      version: `v${int(1, 3)}.${int(0, 9)}`,
    });
    matSeq += 1;
  }

  /* Audit backlog */
  const actions = [
    ["Changed standard description", "Standardisation review"],
    ["Created national material code", "Harmonisation approval"],
    ["Added CPSE mapping", "Legacy code rationalisation"],
    ["Rejected recommendation", "Attribute mismatch on pressure class"],
    ["Assigned reviewer", "Engineering validation required"],
    ["Updated unit of measure", "UOM harmonisation policy NUMM-P-014"],
    ["Executed migration batch", "Scheduled legacy migration window"],
    ["Dismissed duplicate cluster", "Distinct materials confirmed"],
  ];
  for (let i = 0; i < 64; i += 1) {
    const m = pick(materials);
    const [action, reason] = pick(actions);
    audit.push({
      id: `AUD-${pad(audit.length + 1, 5)}`,
      timestamp: daysAgo(int(0, 120), int(0, 23)),
      user: pick(USERS).name,
      role: pick(ROLES as unknown as string[]),
      action: action!,
      entity: m.cpseCode,
      previousValue: m.description.slice(0, 34),
      newValue: (m.standardDescription ?? FAMILIES.find((f) => f.category === m.category)!.std("STD")).slice(0, 44),
      reason: reason!,
      status: pick(["success", "success", "info", "warning"] as const),
    });
  }
  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const pendingReview = clusters.filter((c) => c.status === "under-review" || c.status === "recommended").length;

  const notifications: AppNotification[] = [
    { id: "NTF-1", title: `${pendingReview} clusters awaiting review`, body: "Harmonisation recommendations pending validation across 12 CPSEs.", timestamp: daysAgo(0, 2), read: false, dismissed: false, kind: "review", link: "/harmonize" },
    { id: "NTF-2", title: "Migration validation completed", body: "SAIL legacy batch MIG-0042: 1,284 records validated, 37 conflicts flagged.", timestamp: daysAgo(0, 5), read: false, dismissed: false, kind: "migration", link: "/migration" },
    { id: "NTF-3", title: "New duplicate cluster detected", body: `Cluster ${clusters[3]?.id} — 4 member records in Valves category.`, timestamp: daysAgo(1, 3), read: false, dismissed: false, kind: "duplicate", link: "/duplicates" },
    { id: "NTF-4", title: "Mapping approval required", body: "18 CPSE mappings submitted by BHEL await national administrator sign-off.", timestamp: daysAgo(1, 9), read: false, dismissed: false, kind: "mapping", link: "/mapping" },
    { id: "NTF-5", title: "Data import completed", body: "ONGC_MM_EXTRACT_AUG2026.csv — 4,210 records ingested, 122 rejected.", timestamp: daysAgo(2, 1), read: true, dismissed: false, kind: "import", link: "/migration" },
    { id: "NTF-6", title: "Integration synchronisation completed", body: "NTPC SAP ECC 6.0 delta sync finished in 4m 12s.", timestamp: daysAgo(2, 6), read: true, dismissed: false, kind: "integration", link: "/integrations" },
    { id: "NTF-7", title: "Policy violation raised", body: "UOM inconsistency detected on 9 clusters — governance review required.", timestamp: daysAgo(3, 4), read: false, dismissed: false, kind: "review", link: "/governance" },
  ];

  const integrations: Integration[] = CPSES.map((c, i) => ({
    id: `INT-${pad(i + 1, 3)}`,
    system: c.erp,
    cpseId: c.id,
    status: i % 7 === 0 ? "warning" : i % 5 === 0 ? "syncing" : i === 9 ? "offline" : "connected",
    lastSync: daysAgo(0, int(1, 40)),
    recordsImported: int(12000, 240000),
    recordsExported: int(400, 18000),
    errors: i % 7 === 0 ? int(12, 140) : int(0, 6),
    endpoint: `https://mdm-gw.numm.gov.in/connect/${c.id.toLowerCase()}/mm-master`,
    logs: [
      { timestamp: daysAgo(0, int(1, 6)), level: "info", message: "Delta extraction completed for MARA / MAKT tables" },
      { timestamp: daysAgo(0, int(6, 14)), level: i % 7 === 0 ? "warn" : "info", message: i % 7 === 0 ? "142 records rejected: mandatory field MEINS empty" : "Checksum validation passed for 100% of records" },
      { timestamp: daysAgo(1, int(1, 20)), level: "info", message: "Connection handshake successful (mTLS, cert expiry 2027-03-11)" },
    ],
  }));

  const migrations: MigrationBatch[] = [
    { id: "MIG-0042", cpseId: "SAIL", dataset: "SAIL_MM_LEGACY_2019_2026.csv", legacyRecords: 18420, mapped: 14380, unmapped: 3652, conflicts: 388, status: "ready", startedOn: daysAgo(4), completedOn: null, progress: 78 },
    { id: "MIG-0041", cpseId: "NTPC", dataset: "NTPC_SPARES_EXTRACT.xlsx", legacyRecords: 9240, mapped: 9240, unmapped: 0, conflicts: 0, status: "completed", startedOn: daysAgo(19), completedOn: daysAgo(17), progress: 100 },
    { id: "MIG-0040", cpseId: "ONGC", dataset: "ONGC_MM_EXTRACT_AUG2026.csv", legacyRecords: 22110, mapped: 19870, unmapped: 1902, conflicts: 338, status: "validating", startedOn: daysAgo(2), completedOn: null, progress: 46 },
    { id: "MIG-0039", cpseId: "BHEL", dataset: "BHEL_ORACLE_ITEM_MASTER.json", legacyRecords: 12750, mapped: 6120, unmapped: 6180, conflicts: 450, status: "draft", startedOn: daysAgo(1), completedOn: null, progress: 12 },
    { id: "MIG-0038", cpseId: "CIL", dataset: "CIL_MINING_SPARES.csv", legacyRecords: 15900, mapped: 15310, unmapped: 380, conflicts: 210, status: "completed", startedOn: daysAgo(41), completedOn: daysAgo(38), progress: 100 },
  ];

  const trend: TrendPoint[] = [
    "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26",
    "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26",
  ].map((month, i) => ({
    month,
    imported: 42000 + i * 6400 + int(-2600, 2600),
    matched: 28000 + i * 5900 + int(-2200, 2200),
    standardized: 21000 + i * 5200 + int(-1800, 1800),
    approved: 14000 + i * 4300 + int(-1500, 1500),
  }));

  const classification: ClassificationNode[] = buildClassification();

  return {
    materials,
    clusters,
    nationalCodes,
    mappings,
    audit,
    notifications,
    integrations,
    governance,
    classification,
    trend,
    migrations,
    baseline: {
      totalMaterials: 1_284_632,
      standardized: 842_190,
      duplicateCandidates: 73_416,
      pendingReview: 4_821,
      mappedToNational: 628_430,
      legacyCodes: 512_884,
      rationalisationValue: 1_842,
    },
  };
}

function cluster_uomNote(uoms: string[]) {
  const uniq = [...new Set(uoms)];
  return uniq.length === 1
    ? `Unit of measure consistent (${uniq[0]}) across all member records`
    : `Unit of measure variants ${uniq.join(" / ")} resolved to canonical unit`;
}

function buildClassification(): ClassificationNode[] {
  const map = new Map<string, ClassificationNode>();
  const roots: ClassificationNode[] = [];
  FAMILIES.forEach((f) => {
    let level = 0;
    let parentChildren = roots;
    let prefix = "";
    f.path.forEach((seg) => {
      prefix = prefix ? `${prefix}/${seg}` : seg;
      let node = map.get(prefix);
      if (!node) {
        node = { id: prefix, name: seg, level, children: [] };
        map.set(prefix, node);
        parentChildren.push(node);
      }
      parentChildren = node.children;
      level += 1;
    });
  });
  return roots;
}

export const DATASET = buildDataset();
export const CATEGORIES = [...new Set(DATASET.materials.map((m) => m.category))].sort();
export const UOMS = [...new Set(DATASET.materials.map((m) => m.uom))].sort();
export const FAMILY_KEYS = FAMILIES.map((f) => ({ key: f.key, category: f.category, uom: f.uom }));
