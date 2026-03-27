import { useState } from "react";

const API = "http://127.0.0.1:8000";

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

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
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
        description: item.description || "Food item",
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

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 900 }}>
      <h2>TrueIntake AI</h2>

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
        <select value={nutrient} onChange={(e) => setNutrient(e.target.value)}>
          {nutrientOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
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
              Predicted: {result.predicted_amount_per_day} {result.model_unit}
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
                <strong>{item.description}</strong>
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
              <strong>{item.description}</strong>
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
              <strong>{item.nutrient}</strong> ({item.category}) — {item.label_claim} {item.unit}
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
              Foods: {totals.summary.food_count} | Supplements: {totals.summary.supplement_count} | Nutrients: {totals.summary.nutrient_count}
            </div>
          )}

          {totals.totals?.length ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  gap: 8,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                <div>Nutrient</div>
                <div>From food</div>
                <div>From supplement</div>
                <div>Total</div>
              </div>

              {totals.totals.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div><strong>{item.nutrient}</strong></div>
                  <div>{formatAmount(getFoodAmount(item))} {getUnit(item)}</div>
                  <div>{formatAmount(getSupplementAmount(item))} {getUnit(item)}</div>
                  <div>{formatAmount(getTotalAmount(item))} {getUnit(item)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p>No totals available.</p>
          )}
        </div>
      )}
    </div>
  );
}
