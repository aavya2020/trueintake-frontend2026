import { useState } from "react";

const API = "https://trueintake-backend2026.onrender.com";

const nutrientOptions = [
  "Calcium",
  "Iron",
  "Magnesium",
  "Zinc",
  "Vitamin C",
];

const categoryOptions = [
  { label: "Adult MVM-2017", value: "02" },
  { label: "Children 1-4", value: "03" },
  { label: "Children 4+", value: "04" },
];

const DV_MAP = {
  Calcium: { dv: 1300, unit: "mg", ul: 2500 },
  Iron: { dv: 18, unit: "mg", ul: 45 },
  "Vitamin C": { dv: 90, unit: "mg", ul: 2000 },
  Zinc: { dv: 11, unit: "mg", ul: 40 },
  Magnesium: { dv: 420, unit: "mg", ul: 350 },
};

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function getFoodAmount(item) {
  return item.from_food ?? item.food ?? 0;
}

function getSupplementAmount(item) {
  return item.from_supplement ?? item.supplement ?? 0;
}

function getTotalAmount(item) {
  return item.total ?? 0;
}

function getUnit(item) {
  return item.unit ?? "mg";
}

function getPercentDv(total, nutrient, unit) {
  const info = DV_MAP[nutrient];
  if (!info || info.unit !== unit) return null;
  return (Number(total) / info.dv) * 100;
}

function getStatus(total, nutrient, unit) {
  const info = DV_MAP[nutrient];
  if (!info) return "—";

  const val = Number(total);

  if (info.ul && val > info.ul) return "Above UL";
  const pct = getPercentDv(total, nutrient, unit);

  if (pct < 20) return "Low";
  if (pct < 100) return "Moderate";
  if (pct <= 150) return "Good";
  return "High";
}

export default function App() {
  const [category, setCategory] = useState("02");
  const [nutrient, setNutrient] = useState("Calcium");
  const [label, setLabel] = useState(100);
  const [result, setResult] = useState(null);

  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [supplementStack, setSupplementStack] = useState([]);
  const [totals, setTotals] = useState(null);

  const [isPro, setIsPro] = useState(false);

  const handlePredict = async () => {
    const res = await fetch(`${API}/predict-supplement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category,
        nutrient,
        label_claim: Number(label),
        unit: "mg",
        servings_per_day: 1,
      }),
    });

    const data = await res.json();
    setResult(data);
  };

  const handleFoodSearch = async () => {
    const res = await fetch(
      `${API}/search-food?query=${encodeURIComponent(foodQuery)}`
    );
    const data = await res.json();
    setFoodResults(data.foods || []);
  };

  const handleAddFood = (item) => {
    setSelectedFoods([
      ...selectedFoods,
      { fdc_id: item.fdc_id, description: item.description, grams: 100 },
    ]);
  };

  const handleAddSupplement = () => {
    setSupplementStack([
      ...supplementStack,
      { category, nutrient, label_claim: label, unit: "mg" },
    ]);
  };

  const handleCalculateTotals = async () => {
    const res = await fetch(`${API}/calculate-total-intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supplements: supplementStack,
        foods: selectedFoods,
      }),
    });

    const data = await res.json();
    setTotals(data);
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "auto" }}>
      <h1>TrueIntake AI</h1>
      <p><strong>What you take. What’s really inside.</strong></p>

      <div style={{ marginBottom: 20, background: "#eee", padding: 10 }}>
        <button onClick={() => setIsPro(!isPro)}>
          {isPro ? "Pro ON" : "Unlock Pro Demo"}
        </button>
      </div>

      <div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select value={nutrient} onChange={(e) => setNutrient(e.target.value)}>
          {nutrientOptions.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>

        <input
          type="number"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        <button onClick={handlePredict}>Predict</button>
        <button onClick={handleAddSupplement}>Add</button>
      </div>

      {result && <div>Predicted: {result.predicted_amount_per_day} mg</div>}

      <div>
        <input
          placeholder="food"
          value={foodQuery}
          onChange={(e) => setFoodQuery(e.target.value)}
        />
        <button onClick={handleFoodSearch}>Search</button>

        {foodResults.map((f, i) => (
          <div key={i}>
            {f.description}
            <button onClick={() => handleAddFood(f)}>Add</button>
          </div>
        ))}
      </div>

      <button onClick={handleCalculateTotals}>Calculate</button>

      {totals && (
        <div>
          <h3>Totals</h3>

          {totals.totals.map((item, i) => {
            const total = getTotalAmount(item);
            const unit = getUnit(item);
            const pct = getPercentDv(total, item.nutrient, unit);
            const status = getStatus(total, item.nutrient, unit);

            return (
              <div key={i}>
                {item.nutrient}: {formatAmount(total)} {unit}
                {isPro && (
                  <>
                    {" "} | {pct?.toFixed(1)}% DV | {status}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}