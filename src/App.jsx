import { useEffect, useState } from "react";

const API =
  import.meta.env.VITE_API_BASE ||
  "https://trueintake-backend2026.onrender.com";

const categoryOptions = [
  { label: "Adult MVM-2017", value: "02" },
  { label: "Children 1-4", value: "03" },
  { label: "Children 4+", value: "04" },
];

const categoryLabelMap = Object.fromEntries(
  categoryOptions.map((c) => [c.value, c.label])
);

const DV_MAP = {
  "Vitamin A": { dv: 900, unit: "mcg", ul: 3000 },
  "Vitamin C": { dv: 90, unit: "mg", ul: 2000 },
  "Vitamin D": { dv: 20, unit: "mcg", ul: 100 },
  "Vitamin E": { dv: 15, unit: "mg", ul: 1000 },
  "Vitamin K": { dv: 120, unit: "mcg", ul: null },
  Thiamin: { dv: 1.2, unit: "mg", ul: null },
  Riboflavin: { dv: 1.3, unit: "mg", ul: null },
  Niacin: { dv: 16, unit: "mg", ul: 35 },
  "Vitamin B6": { dv: 1.7, unit: "mg", ul: 100 },
  Folate: { dv: 400, unit: "mcg", ul: 1000 },
  "Vitamin B12": { dv: 2.4, unit: "mcg", ul: null },
  Biotin: { dv: 30, unit: "mcg", ul: null },
  Pantothenic: { dv: 5, unit: "mg", ul: null },
  Choline: { dv: 550, unit: "mg", ul: 3500 },
  Calcium: { dv: 1300, unit: "mg", ul: 2500 },
  Iron: { dv: 18, unit: "mg", ul: 45 },
  Magnesium: { dv: 420, unit: "mg", ul: 350 },
  Phosphorus: { dv: 1250, unit: "mg", ul: 4000 },
  Iodine: { dv: 150, unit: "mcg", ul: 1100 },
  Zinc: { dv: 11, unit: "mg", ul: 40 },
  Selenium: { dv: 55, unit: "mcg", ul: 400 },
  Copper: { dv: 0.9, unit: "mg", ul: 10 },
  Manganese: { dv: 2.3, unit: "mg", ul: 11 },
  Chromium: { dv: 35, unit: "mcg", ul: null },
  Molybdenum: { dv: 45, unit: "mcg", ul: 2000 },
  Potassium: { dv: 4700, unit: "mg", ul: null },
};

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function normalizeNutrientName(name) {
  return String(name || "").trim();
}

function prettyFoodName(text) {
  if (!text) return "Food item";
  return String(text).trim();
}

function getFoodAmount(item) {
  return (
    item.from_food ??
    item.food ??
    item.food_total ??
    item.food_amount ??
    item.amount_from_food ??
    0
  );
}

function getSupplementAmount(item) {
  return (
    item.from_supplement ??
    item.supplement ??
    item.supplement_total ??
    item.supplement_amount ??
    item.amount_from_supplement ??
    0
  );
}

function getTotalAmount(item) {
  return item.total ?? item.total_amount ?? item.combined_total ?? 0;
}

function getUnit(item) {
  return item.unit ?? "mg";
}

function getDvInfo(nutrient) {
  return DV_MAP[normalizeNutrientName(nutrient)] || null;
}

function getPercentDv(total, nutrient, unit) {
  const info = getDvInfo(nutrient);
  if (!info || !info.dv) return null;
  if (info.unit !== unit) return null;
  const value = Number(total);
  if (Number.isNaN(value)) return null;
  return (value / info.dv) * 100;
}

function getStatusLabel(total, nutrient, unit) {
  const info = getDvInfo(nutrient);
  const value = Number(total);
  if (Number.isNaN(value)) return "Unknown";

  if (info && info.unit === unit && info.ul && value > info.ul) {
    return "Above upper limit";
  }

  const pct = getPercentDv(total, nutrient, unit);
  if (pct === null) return "No reference";

  if (pct < 20) return "Low";
  if (pct < 100) return "Moderate";
  if (pct <= 150) return "Meets daily needs";
  return "High";
}

export default function App() {
  const [category, setCategory] = useState("02");
  const [nutrient, setNutrient] = useState("Calcium");
  const [nutrientOptions, setNutrientOptions] = useState(["Calcium"]);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState(false);
  const [nutrientError, setNutrientError] = useState("");

  const [label, setLabel] = useState(100);
  const [result, setResult] = useState(null);

  const [foodQuery, setFoodQuery] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [supplementStack, setSupplementStack] = useState([]);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadNutrients() {
      setIsLoadingNutrients(true);
      setNutrientError("");

      try {
        const res = await fetch(
          `${API}/nutrients?category=${encodeURIComponent(category)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error("Could not load nutrients");
        }

        let items = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (Array.isArray(data.nutrients)) {
          items = data.nutrients;
        } else if (typeof data === "object" && data !== null) {
          items = Object.values(data).flat().filter(Boolean);
        }

        const cleaned = [
          ...new Set(items.map((x) => String(x).trim()).filter(Boolean)),
        ].sort();

        if (!ignore && cleaned.length) {
          setNutrientOptions(cleaned);
          if (!cleaned.includes(nutrient)) {
            setNutrient(cleaned[0]);
          }
        }
      } catch (err) {
        if (!ignore) {
          setNutrientError(err.message || "Failed to load nutrients");
          setNutrientOptions(["Calcium"]);
          setNutrient("Calcium");
        }
      } finally {
        if (!ignore) {
          setIsLoadingNutrients(false);
        }
      }
    }

    loadNutrients();

    return () => {
      ignore = true;
    };
  }, [category]);

  const handlePredict = async () => {
    try {
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

      if (!res.ok) {
        setResult({ error: data.detail?.message || "Not supported" });
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult({ error: err.message });
    }
  };

  const handleFoodSearch = async () => {
    try {
      const res = await fetch(
        `${API}/search-food?query=${encodeURIComponent(foodQuery)}`
      );
      const data = await res.json();
      setFoodResults(Array.isArray(data.foods) ? data.foods : []);
    } catch (err) {
      setFoodResults([]);
      alert("Food search error: " + err.message);
    }
  };

  const handleAddFood = (item) => {
    setSelectedFoods([
      ...selectedFoods,
      {
        fdc_id: item.fdc_id || item.fdcId,
        description: prettyFoodName(item.description || "Food item"),
        grams: 100,
      },
    ]);
  };

  const handleRemoveFood = (indexToRemove) => {
    setSelectedFoods(selectedFoods.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFoodGramsChange = (indexToUpdate, gramsValue) => {
    setSelectedFoods(
      selectedFoods.map((item, idx) =>
        idx === indexToUpdate
          ? { ...item, grams: Number(gramsValue) || 0 }
          : item
      )
    );
  };

  const handleAddSupplement = () => {
    setSupplementStack([
      ...supplementStack,
      {
        category,
        nutrient,
        label_claim: Number(label),
        unit: "mg",
        servings_per_day: 1,
      },
    ]);
  };

  const handleRemoveSupplement = (indexToRemove) => {
    setSupplementStack(
      supplementStack.filter((_, idx) => idx !== indexToRemove)
    );
  };

  const handleCalculateTotals = async () => {
    try {
      const res = await fetch(`${API}/calculate-total-intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplements: supplementStack.map((item) => ({
            category: item.category,
            nutrient: item.nutrient,
            label_claim: item.label_claim,
            unit: item.unit || "mg",
            servings_per_day: item.servings_per_day || 1,
          })),
          foods: selectedFoods.map((item) => ({
            fdc_id: item.fdc_id,
            grams: Number(item.grams) || 100,
          })),
        }),
      });

      const data = await res.json();
      setTotals(data);
    } catch (err) {
      console.error(err);
      alert("Error calculating totals");
    }
  };

  const hasUpperLimitWarning =
    totals?.totals?.some((item) => {
      const status = getStatusLabel(
        getTotalAmount(item),
        item.nutrient,
        getUnit(item)
      );
      return status === "Above upper limit";
    }) || false;

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1000 }}>
      <h2>TrueIntake AI</h2>
      <p>Estimate nutrient intake from supplements and foods.</p>

      <div style={{ marginBottom: 12 }}>
        <label>Category: </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Nutrient: </label>
        <select
          value={nutrient}
          onChange={(e) => setNutrient(e.target.value)}
          disabled={isLoadingNutrients}
        >
          {nutrientOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {isLoadingNutrients && (
          <div style={{ fontSize: 12, marginTop: 4 }}>Loading nutrients...</div>
        )}
        {nutrientError && (
          <div style={{ fontSize: 12, marginTop: 4, color: "red" }}>
            {nutrientError}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Label claim: </label>
        <input
          type="number"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <button onClick={handlePredict}>Predict</button>
        <button onClick={handleAddSupplement}>Add to stack</button>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Result</h3>
          {result.predicted_amount_per_day ? (
            <p>
              Predicted: {formatAmount(result.predicted_amount_per_day)}{" "}
              {result.model_unit || "mg"}
            </p>
          ) : (
            <p style={{ color: "red" }}>
              {result.error || "No model available for this nutrient in this category"}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3>Food search</h3>
        <input
          type="text"
          placeholder="Search foods"
          value={foodQuery}
          onChange={(e) => setFoodQuery(e.target.value)}
        />
        <button onClick={handleFoodSearch} style={{ marginLeft: 8 }}>
          Search
        </button>

        <div style={{ marginTop: 12 }}>
          {foodResults.length === 0 ? (
            <p>No food results yet.</p>
          ) : (
            foodResults.slice(0, 10).map((item, idx) => (
              <div
                key={item.fdc_id || item.fdcId || idx}
                style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #ddd" }}
              >
                <strong>{prettyFoodName(item.description)}</strong>
                <div>FDC ID: {item.fdc_id || item.fdcId}</div>
                <button onClick={() => handleAddFood(item)}>Add</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Selected foods</h3>
        {selectedFoods.length === 0 ? (
          <p>No foods selected yet.</p>
        ) : (
          selectedFoods.map((item, idx) => (
            <div
              key={`${item.fdc_id || idx}-${idx}`}
              style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #ddd" }}
            >
              <strong>{prettyFoodName(item.description)}</strong>
              <div>FDC ID: {item.fdc_id}</div>
              <div style={{ marginTop: 6 }}>
                <label>Grams: </label>
                <input
                  type="number"
                  value={item.grams}
                  onChange={(e) => handleFoodGramsChange(idx, e.target.value)}
                  style={{ width: 80, marginRight: 8 }}
                />
                <button onClick={() => handleRemoveFood(idx)}>Remove</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Supplement stack</h3>
        {supplementStack.length === 0 ? (
          <p>No supplements added yet.</p>
        ) : (
          supplementStack.map((item, idx) => (
            <div
              key={idx}
              style={{ marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #ddd" }}
            >
              <strong>{item.nutrient}</strong> (
              {categoryLabelMap[item.category] || item.category}) —{" "}
              {formatAmount(item.label_claim)} {item.unit}
              <div style={{ marginTop: 6 }}>
                <button onClick={() => handleRemoveSupplement(idx)}>Remove</button>
              </div>
            </div>
          ))
        )}

        <button onClick={handleCalculateTotals} style={{ marginTop: 12 }}>
          Calculate totals
        </button>
      </div>

      {totals && (
        <div style={{ marginTop: 24 }}>
          <h3>Combined totals</h3>

          {totals.summary && (
            <div style={{ marginBottom: 12 }}>
              Foods: {totals.summary.food_count} | Supplements:{" "}
              {totals.summary.supplement_count} | Nutrients:{" "}
              {totals.summary.nutrient_count}
            </div>
          )}

          {hasUpperLimitWarning && (
            <div
              style={{
                background: "#fff4e5",
                border: "1px solid #f5c16c",
                padding: 10,
                marginBottom: 12,
              }}
            >
              Warning: one or more nutrients may be above the tolerable upper
              limit.
            </div>
          )}

          {totals.totals?.length ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr",
                  gap: 8,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                <div>Nutrient</div>
                <div>From food</div>
                <div>From supplement</div>
                <div>Total</div>
                <div>%DV</div>
                <div>Status</div>
              </div>

              {totals.totals.map((item, idx) => {
                const totalAmount = getTotalAmount(item);
                const unit = getUnit(item);
                const percentDv = getPercentDv(totalAmount, item.nutrient, unit);
                const status = getStatusLabel(totalAmount, item.nutrient, unit);

                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.5fr",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <strong>{item.nutrient}</strong>
                    </div>
                    <div>
                      {formatAmount(getFoodAmount(item))} {unit}
                    </div>
                    <div>
                      {formatAmount(getSupplementAmount(item))} {unit}
                    </div>
                    <div>
                      {formatAmount(totalAmount)} {unit}
                    </div>
                    <div>
                      {percentDv === null ? "—" : `${formatAmount(percentDv)}%`}
                    </div>
                    <div>{status}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>No totals available.</p>
          )}
        </div>
      )}
    </div>
  );
}
