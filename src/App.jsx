import { useState } from "react";

const API =
  import.meta.env.VITE_API_BASE ||
  "https://trueintake-backend2026.onrender.com";

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

const categoryLabelMap = Object.fromEntries(
  categoryOptions.map((c) => [c.value, c.label])
);

const DV_MAP = {
  Calcium: { dv: 1300, unit: "mg", ul: 2500 },
  Iron: { dv: 18, unit: "mg", ul: 45 },
  "Vitamin C": { dv: 90, unit: "mg", ul: 2000 },
  Zinc: { dv: 11, unit: "mg", ul: 40 },
  Magnesium: { dv: 420, unit: "mg", ul: 350 },
};

const SUPPORTED_IMPORT_NUTRIENTS = new Set([
  "Calcium",
  "Iron",
  "Magnesium",
  "Zinc",
  "Vitamin C",
  "Vitamin D",
  "Vitamin B-12",
  "Folic Acid",
  "Vitamin A",
  "Vitamin E",
  "Copper",
  "Iodine",
]);

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

function getPercentDv(total, nutrient, unit) {
  const info = DV_MAP[nutrient];
  if (!info || info.unit !== unit) return null;
  const val = Number(total);
  if (Number.isNaN(val)) return null;
  return (val / info.dv) * 100;
}

function getStatus(total, nutrient, unit) {
  const info = DV_MAP[nutrient];
  if (!info || info.unit !== unit) return "—";

  const val = Number(total);
  if (Number.isNaN(val)) return "—";

  if (info.ul && val > info.ul) return "Above UL";

  const pct = getPercentDv(total, nutrient, unit);
  if (pct === null) return "—";
  if (pct < 20) return "Low";
  if (pct < 100) return "Moderate";
  if (pct <= 150) return "Good";
  return "High";
}

function normalizeImportUnit(unit) {
  if (!unit) return "mg";

  const raw = String(unit).trim().toLowerCase();

  if (raw === "iu") return "iu";
  if (raw === "mcg dfe") return "mcg dfe";
  if (raw === "μg") return "mcg";
  if (raw === "µg") return "mcg";
  if (raw === "grams") return "g";
  if (raw === "gram(s)") return "g";
  if (raw === "milligram(s)") return "mg";
  if (raw === "microgram(s)") return "mcg";

  return raw;
}

function normalizeDsldName(name) {
  const raw = String(name || "").trim().toLowerCase();

  if (raw === "vitamin b12") return "Vitamin B-12";
  if (raw === "b12") return "Vitamin B-12";
  if (raw === "folate") return "Folic Acid";
  if (raw === "vitamin d3") return "Vitamin D";
  if (raw === "vitamin a palmitate") return "Vitamin A";
  if (raw === "retinol") return "Vitamin A";

  return String(name || "").trim();
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

  const [supplementImageName, setSupplementImageName] = useState("");
  const [foodImageName, setFoodImageName] = useState("");

  const [dsldQuery, setDsldQuery] = useState("");
  const [dsldResults, setDsldResults] = useState([]);
  const [dsldLoading, setDsldLoading] = useState(false);
  const [dsldError, setDsldError] = useState("");
  const [selectedDsldProduct, setSelectedDsldProduct] = useState(null);
  const [dsldDetailLoading, setDsldDetailLoading] = useState(false);
  const [dsldDetailError, setDsldDetailError] = useState("");

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
      setResult({ error: err.message || "Prediction failed" });
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
            label_claim: Number(item.label_claim),
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

      if (!res.ok) {
        alert(
          data.detail?.message ||
            data.message ||
            "Could not calculate totals for one or more stack items."
        );
        setTotals(null);
        return;
      }

      setTotals(data);
    } catch (err) {
      console.error(err);
      alert("Error calculating totals");
      setTotals(null);
    }
  };

  const handleDsldSearch = async () => {
    const q = dsldQuery.trim();
    if (!q) return;

    setDsldLoading(true);
    setDsldError("");
    setDsldResults([]);
    setSelectedDsldProduct(null);
    setDsldDetailError("");

    try {
      const res = await fetch(
        `${API}/dsld-search?query=${encodeURIComponent(q)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setDsldError(
          data.detail?.message || data.message || "DSLD search failed"
        );
        return;
      }

      setDsldResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      setDsldError(err.message || "DSLD search failed");
    } finally {
      setDsldLoading(false);
    }
  };

  const handleViewDsldProduct = async (productId) => {
    if (!productId) return;

    setDsldDetailLoading(true);
    setDsldDetailError("");
    setSelectedDsldProduct(null);

    try {
      const res = await fetch(`${API}/dsld-product/${productId}`);
      const data = await res.json();

      if (!res.ok) {
        setDsldDetailError(
          data.detail?.message || data.message || "Could not load product details"
        );
        return;
      }

      setSelectedDsldProduct(data);
    } catch (err) {
      setDsldDetailError(err.message || "Could not load product details");
    } finally {
      setDsldDetailLoading(false);
    }
  };

const handleImportDsldProduct = () => {
  const rows = selectedDsldProduct?.raw?.ingredientRows || [];

  if (!rows.length) {
    alert("No ingredient data found.");
    return;
  }

  const SUPPORTED = ["Calcium", "Iron", "Magnesium", "Zinc"];

  const imported = [];
  const skipped = [];

  rows.forEach((row) => {
    const qty = row.quantity?.[0];
    const name = normalizeDsldName(row?.name);

    if (!qty?.quantity || !qty?.unit) {
      skipped.push(name || "Unknown");
      return;
    }

    if (!SUPPORTED.includes(name)) {
      skipped.push(name);
      return;
    }

    imported.push({
      category,
      nutrient: name,
      label_claim: Number(qty.quantity),
      unit: normalizeImportUnit(qty.unit),
      servings_per_day: 1,
    });
  });

  if (!imported.length) {
    alert("No supported nutrients found for prediction.");
    return;
  }

  setSupplementStack((prev) => [...prev, ...imported]);

  alert(
    `Imported: ${imported.map((i) => i.nutrient).join(", ")}\n` +
    (skipped.length ? `Skipped: ${[...new Set(skipped)].join(", ")}` : "")
  );
};

  const onSupplementImageChange = (e) => {
    const file = e.target.files?.[0];
    setSupplementImageName(file ? file.name : "");
  };

  const onFoodImageChange = (e) => {
    const file = e.target.files?.[0];
    setFoodImageName(file ? file.name : "");
  };

  const hasUpperLimitWarning =
    totals?.totals?.some((item) => {
      const total = getTotalAmount(item);
      const unit = getUnit(item);
      return getStatus(total, item.nutrient, unit) === "Above UL";
    }) || false;

  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  };

  const detailBox = {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  };

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 980,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          ...card,
          background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
          border: "1px solid #dbeafe",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "#4338ca",
            background: "#e0e7ff",
            padding: "6px 10px",
            borderRadius: 999,
            marginBottom: 12,
          }}
        >
          Beta
        </div>

        <h1 style={{ margin: "0 0 8px 0" }}>TrueIntake AI</h1>
        <p style={{ margin: "0 0 8px 0", fontWeight: 700 }}>
          What you take. What’s really inside.
        </p>
        <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
          Estimate real nutrient intake from supplements and foods. See where
          your totals come from, compare against Daily Value, and spot possible
          excess before it becomes a problem.
        </p>
      </div>

      <div
        style={{
          ...card,
          background: isPro ? "#ecfdf5" : "#fff7ed",
          border: isPro ? "1px solid #a7f3d0" : "1px solid #fdba74",
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          {isPro ? "Pro is unlocked" : "Unlock TrueIntake Pro"}
        </h3>
        <p style={{ color: "#4b5563" }}>
          Pro adds %DV, intake status, and safety insight flags. For now, this
          is a demo unlock so you can test premium value before payments go
          live.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ background: "#fff", padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            %DV insights
          </div>
          <div style={{ background: "#fff", padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            Low / High status
          </div>
          <div style={{ background: "#fff", padding: "8px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            Excess warnings
          </div>
        </div>

        <button onClick={() => setIsPro((v) => !v)}>
          {isPro ? "Turn off Pro demo" : "Unlock Pro demo"}
        </button>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Supplement label image</h3>
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Upload UI is ready. OCR/label extraction should be added through the backend next.
        </p>
        <input type="file" accept="image/*" onChange={onSupplementImageChange} />
        {supplementImageName && (
          <div style={{ marginTop: 8 }}>Selected file: {supplementImageName}</div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Food label or food image</h3>
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Upload UI is ready. Nutrition-label OCR or food-photo analysis should be added next.
        </p>
        <input type="file" accept="image/*" onChange={onFoodImageChange} />
        {foodImageName && <div style={{ marginTop: 8 }}>Selected file: {foodImageName}</div>}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Search supplement products in NIH DSLD</h3>
        <p style={{ color: "#4b5563", marginTop: 0 }}>
          Search the NIH Dietary Supplement Label Database directly inside the app.
        </p>

        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="e.g. fish oil, Centrum Silver, vitamin D"
            value={dsldQuery}
            onChange={(e) => setDsldQuery(e.target.value)}
            style={{ marginRight: 8, minWidth: 260 }}
          />
          <button onClick={handleDsldSearch} disabled={dsldLoading}>
            {dsldLoading ? "Searching..." : "Search DSLD"}
          </button>
        </div>

        {dsldError && (
          <div style={{ color: "red", marginBottom: 12 }}>{dsldError}</div>
        )}

        {dsldResults.length > 0 && (
          <div style={detailBox}>
            <strong>Search results</strong>
            <div style={{ marginTop: 10 }}>
              {dsldResults.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    borderBottom: idx < dsldResults.length - 1 ? "1px solid #e5e7eb" : "none",
                    padding: "10px 0",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{item.name || "Unnamed product"}</div>
                  <div style={{ color: "#4b5563", margin: "4px 0" }}>
                    {item.brand || "Brand unavailable"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                    DSLD ID: {item.id || "N/A"}
                  </div>
                  <button onClick={() => handleViewDsldProduct(item.id)}>
                    View details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {dsldDetailLoading && (
          <div style={{ marginTop: 12 }}>Loading product details...</div>
        )}

        {dsldDetailError && (
          <div style={{ color: "red", marginTop: 12 }}>{dsldDetailError}</div>
        )}

        {selectedDsldProduct && (
          <div style={detailBox}>
            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Selected DSLD product</h4>

            <div>
              <strong>Name:</strong>{" "}
              {selectedDsldProduct.name || selectedDsldProduct.raw?.fullName || "N/A"}
            </div>

            <div>
              <strong>Brand:</strong>{" "}
              {selectedDsldProduct.brand || selectedDsldProduct.raw?.brandName || "N/A"}
            </div>

            <div>
              <strong>Product ID:</strong> {selectedDsldProduct.product_id || "N/A"}
            </div>

            {selectedDsldProduct.raw?.ingredientRows?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Supplement Facts</strong>
                <div style={{ marginTop: 8 }}>
                  {selectedDsldProduct.raw.ingredientRows.map((row, idx) => {
                    const qty = row.quantity?.[0];
                    return (
                      <div key={idx} style={{ marginTop: 4 }}>
                        {row.name} — {qty?.quantity} {qty?.unit}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleImportDsldProduct}
                  style={{ marginTop: 12 }}
                >
                  Import into stack
                </button>
              </div>
            )}

            {selectedDsldProduct.ingredients?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Ingredients</strong>
                <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(selectedDsldProduct.ingredients, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {selectedDsldProduct.label_statements?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <strong>Label statements</strong>
                <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto" }}>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      margin: 0,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(selectedDsldProduct.label_statements, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <details style={{ marginTop: 12 }}>
              <summary>Show raw product JSON</summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                {JSON.stringify(selectedDsldProduct.raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Supplement prediction</h3>

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

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handlePredict}>Predict</button>
          <button onClick={handleAddSupplement}>Add to stack</button>
        </div>

        {result && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Result</h3>
            {result.predicted_amount_per_day ? (
              <div>
                Predicted: {formatAmount(result.predicted_amount_per_day)}{" "}
                {result.model_unit || "mg"}
              </div>
            ) : (
              <div style={{ color: "red" }}>
                {result.error || "No model available for this nutrient in this category"}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Food search</h3>
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
                style={{
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: "1px solid #ddd",
                }}
              >
                <strong>{item.description}</strong>
                <div>FDC ID: {item.fdc_id || item.fdcId}</div>
                <button onClick={() => handleAddFood(item)}>Add</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Selected foods</h3>
        {selectedFoods.length === 0 ? (
          <p>No foods selected yet.</p>
        ) : (
          selectedFoods.map((item, idx) => (
            <div
              key={`${item.fdc_id || idx}-${idx}`}
              style={{
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #ddd",
              }}
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

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Supplement stack</h3>
        {supplementStack.length === 0 ? (
          <p>No supplements added yet.</p>
        ) : (
          supplementStack.map((item, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #ddd",
              }}
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
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Combined totals</h3>

          {totals.summary && (
            <div style={{ marginBottom: 12 }}>
              Foods: {totals.summary.food_count} | Supplements:{" "}
              {totals.summary.supplement_count} | Nutrients:{" "}
              {totals.summary.nutrient_count}
            </div>
          )}

          {!isPro && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #93c5fd",
                padding: 12,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <strong>Pro preview locked.</strong> Unlock Pro demo above to see
              %DV, intake status, and excess warnings.
            </div>
          )}

          {isPro && hasUpperLimitWarning && (
            <div
              style={{
                background: "#fff4e5",
                border: "1px solid #f5c16c",
                padding: 10,
                marginBottom: 12,
              }}
            >
              Warning: one or more nutrients may be above the tolerable upper limit.
            </div>
          )}

          {totals.totals?.length ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isPro
                    ? "2fr 1fr 1fr 1fr 1fr 1.5fr"
                    : "2fr 1fr 1fr 1fr",
                  gap: 8,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                <div>Nutrient</div>
                <div>From food</div>
                <div>From supplement</div>
                <div>Total</div>
                {isPro && <div>%DV</div>}
                {isPro && <div>Status</div>}
              </div>

              {totals.totals.map((item, idx) => {
                const total = getTotalAmount(item);
                const unit = getUnit(item);
                const pct = getPercentDv(total, item.nutrient, unit);
                const status = getStatus(total, item.nutrient, unit);

                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isPro
                        ? "2fr 1fr 1fr 1fr 1fr 1.5fr"
                        : "2fr 1fr 1fr 1fr",
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
                      {formatAmount(total)} {unit}
                    </div>
                    {isPro && <div>{pct === null ? "—" : `${formatAmount(pct)}%`}</div>}
                    {isPro && <div>{status}</div>}
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