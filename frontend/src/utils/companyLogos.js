import NivaBupaLogo from "../assets/niva-bupa.png";
import LicLogo from "../assets/lic.jpg";
import DigitLogo from "../assets/digit.png";
import CareLogo from "../assets/care.png";
import HdfcLifeLogo from "../assets/hdfc-life.png";
import HdfcErgoLogo from "../assets/hdfc-ergo.png";
import AckoLogo from "../assets/Acko.jpg";
import StarLogo from "../assets/star-health.png";
import IciciPruLogo from "../assets/icici-pru.jpg";
import IciciLombardLogo from "../assets/icici-lombard.jpg";
import MaxLifeLogo from "../assets/max-life.png";
import AdityaBirlaLogo from "../assets/aditya-birla.jpg";
import SbiLifeLogo from "../assets/sbi-life.png";
import BajajLogo from "../assets/bajaj.png";
import TataAigLogo from "../assets/tata-aig.png";
import TataAiaLogo from "../assets/tata-aia.png";
import NewIndiaLogo from "../assets/new-india.png";
import KotakLogo from "../assets/kotak.jpg";

export const COMPANY_LOGOS = {
  "Niva Bupa": NivaBupaLogo,
  "LIC": LicLogo,
  "Digit": DigitLogo,
  "Care": CareLogo,
  "HDFC Life": HdfcLifeLogo,
  "HDFC ERGO": HdfcErgoLogo,
  "Acko": AckoLogo,
  "Star Health": StarLogo,
  "ICICI Pru": IciciPruLogo,
  "ICICI Lombard": IciciLombardLogo,
  "Max Life": MaxLifeLogo,
  "Aditya Birla": AdityaBirlaLogo,
  "SBI Life": SbiLifeLogo,
  "Bajaj Allianz": BajajLogo,
  "Tata AIG": TataAigLogo,
  "Tata AIA": TataAiaLogo,
  "New India Assurance": NewIndiaLogo,
  "Kotak": KotakLogo,
};

export function getCompanyLogo(policyName) {
  const matchedKey = Object.keys(COMPANY_LOGOS).find((company) =>
    policyName.startsWith(company)
  );
  return matchedKey ? COMPANY_LOGOS[matchedKey] : null;
}

export function getPolicyLogo(policy) {
  if (!policy) return null;
  if (policy.logo) return policy.logo;
  return policy.name ? getCompanyLogo(String(policy.name)) : null;
}
