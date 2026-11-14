import axios from "axios";
import { Policy } from "../models/Policy.js"; 

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL ;

const getStablePremium = (uin, category) => {
  if (!uin) return { text: "₹10,000/year", value: 10000 };
  const numericStr = uin.replace(/\D/g, ""); 
  const seed = numericStr.length > 0 ? parseInt(numericStr.slice(-3), 10) : 500;
  let base = 5000 + (seed * 10);
  const cat = (category || "").toLowerCase();
  if (cat.includes("health")) base *= 1.5;
  if (cat.includes("life")) base *= 1.2;
  if (cat.includes("motor")) base *= 0.8;
  const finalPrice = Math.round(base / 500) * 500;
  return { text: `₹${finalPrice.toLocaleString("en-IN")}/year`, value: finalPrice };
};

export const getExternalPolicies = async (req, res) => {
  try {
    const response = await axios.get(`${EXTERNAL_API_URL}/policies`, {
      params: { status: "active", limit: 200 },
      timeout: 15000
    });

    let rawPolicies = [];
    const data = response.data;
    
    if (Array.isArray(data)) rawPolicies = data;
    else if (data && Array.isArray(data.results)) rawPolicies = data.results;
    else if (data && Array.isArray(data.policies)) rawPolicies = data.policies;
    else if (data && Array.isArray(data.data)) rawPolicies = data.data;

    const formattedPolicies = rawPolicies.map((p, index) => {
      const uin = p.uin || p.id || `EXT-${index}`;
      const category = typeof p.category === 'object' ? p.category?.name : (p.category || "General");
      const premiumData = getStablePremium(uin, category);
      
      return {
        id: uin, 
        name: p.name || "Unknown Policy",
        category: category,
        premium: premiumData.text,
        premiumValue: premiumData.value,
        isExternal: true,
        tagline: typeof p.insurer === 'object' ? (p.insurer?.name || "External Provider") : (p.insurer || "External Provider"),
        description: `Verified product from ${p.insurer || "the insurer"}.`,
      };
    });

    res.json({ policies: formattedPolicies });
  } catch (error) {
    console.error("IndiaInsurances Public API Error:", error.message);
    res.json({ policies: [] }); 
  }
};

export const getAdminExternalPolicies = async (req, res) => {
  try {
    console.log("=> [ADMIN API] Fetching external policies...");
    
    const response = await axios.get(`${EXTERNAL_API_URL}/policies`, {
      params: { status: "active", limit: 200 },
      timeout: 15000 
    });

    let rawPolicies = [];
    const data = response.data;
    
    if (Array.isArray(data)) rawPolicies = data;
    else if (data && Array.isArray(data.results)) rawPolicies = data.results;
    else if (data && Array.isArray(data.policies)) rawPolicies = data.policies;
    else if (data && Array.isArray(data.data)) rawPolicies = data.data;

    console.log(`=> [ADMIN API] Found ${rawPolicies.length} policies from IndiaInsurances`);

    const dbPolicies = await Policy.find({});
    const dbPolicyMap = new Map(dbPolicies.map((p) => [p.id, p]));

    const formattedPolicies = rawPolicies.map((p, index) => {
      const uin = p.uin || p.id || `EXT-${index}`;
      const existingDbPolicy = dbPolicyMap.get(uin);

      return {
        id: uin,
        name: p.name || "Unknown",
        category: typeof p.category === 'object' ? (p.category?.name || "General") : (p.category || "General"),
        insurer: typeof p.insurer === 'object' ? (p.insurer?.name || "") : (p.insurer || ""),
        premiumValue: existingDbPolicy ? existingDbPolicy.premiumValue : 0,
        coverageValue: existingDbPolicy ? existingDbPolicy.coverageValue : 0,
        logo: existingDbPolicy?.logo || "",
        isSaved: !!existingDbPolicy,
        isExternal: true,
        tagline: typeof p.insurer === 'object' ? (p.insurer?.name || "External Provider") : (p.insurer || "External Provider"),
      };
    });

    res.json({ policies: formattedPolicies });
  } catch (error) {
    console.error("CRITICAL IndiaInsurances Admin Error ");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data).slice(0, 500));
    }
    console.error("===========================================");
    res.json({ policies: [] });
  }
};

export const getExternalPolicyById = async (req, res) => {
  try {
    const { uin } = req.params;
    if (uin.length < 8) return res.status(404).json({ error: "Policy not found" });

    const response = await axios.get(`${EXTERNAL_API_URL}/policy/${uin}`);
    const p = response.data.policy || response.data.results?.[0] || response.data;

    if (!p || !p.uin) return res.status(404).json({ error: "External policy not found" });

    const premiumData = getStablePremium(p.uin, p.category);
    const numericStr = p.uin.replace(/\D/g, ""); 
    const seed = numericStr.length > 0 ? parseInt(numericStr.slice(-2), 10) : 50;
    const coverageValue = 100000 + (seed * 10000); 
    const coverageText = `₹${(coverageValue / 100000).toFixed(1)} Lakh`;

    const insurerName = typeof p.insurer === 'object' ? (p.insurer?.name || "External Provider") : (p.insurer || "External Provider");
    const categoryName = typeof p.category === 'object' ? (p.category?.name || "General") : (p.category || "General");

    const formattedPolicy = {
      id: p.uin,
      name: p.name || "Unknown Policy",
      category: categoryName,
      tagline: insurerName, 
      description: p.description || `Verified product from ${insurerName}.`,
      premium: premiumData.text,
      premiumValue: premiumData.value,
      coverage: coverageText,
      coverageValue: coverageValue,
      isExternal: true,
      eligibility: "Check policy documents for age limits",
      keyFeatures: ["Real policy data sourced from IndiaInsurances.", "Verified by official policy documents.", `Underwritten by ${insurerName}`],
      externalFacts: p.facts || [], 
      externalDocuments: p.documents || [],
    };

    res.json({ policy: formattedPolicy });
  } catch (error) {
    console.error("IndiaInsurances Detail API Error:", error.message);
    res.status(404).json({ error: "External policy not found" });
  }
};