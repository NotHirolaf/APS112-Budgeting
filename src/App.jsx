import React, { useState, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { RefreshCw, Maximize2, X } from 'lucide-react';

// ─── Current solution cost (hardcoded) — edit this value to update the comparison
const CURRENT_SOLUTION_COST = 0;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  pageBg:    '#BDD0E4',   // light steel blue
  yellow:    '#F5C83A',   // main yellow
  navy:      '#1B2D5A',   // dark navy
  navyLight: '#253F7A',   // slightly lighter navy for hover
  inputBg:   '#D9D9D9',   // gray input field
  white:     '#FFFFFF',
};

// ─── Chart segment colours ────────────────────────────────────────────────────
const CHART_COLORS = ['#5B8DD9', '#8B6BB5', '#F5C83A', '#A8C4E0'];

// ─── Tab / field config ───────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: 'OVERVIEW'              },
  { id: 'materials',   label: 'Materials and Tools'   },
  { id: 'labour',      label: 'Labour and Staffing'   },
  { id: 'taxes',       label: 'Taxes and Fees'        },
  { id: 'utilities',   label: 'Utilities'              },
  { id: 'reusability', label: 'Reusability %'         },
  { id: 'costmodel',   label: 'Cost Model'            },
];

const FIELDS = {
  materials: [
    'Material Costs - Above Ground',
    'Material Costs - Underground',
    'Materials Used Within Tools',
    'Machinery',
    'Tool Costs',
    'Manufacturing Fees',
  ],
  labour: [
    'General Labour Costs',
    'Salaries: Construction Workers',
    'Salaries: Engineers',
    'Salaries: Project Managers',
    'Salaries: Machinery Operators',
  ],
  taxes: [
    'Insurance',
    'HST Taxes',
    'Taxes - Deductible',
    'Taxes - Payable',
    'Property Taxes',
    'Shipping / Import-Export Fees',
    'Licensing Fees',
  ],
  utilities: [
    'Electricity / Power Bill',
    'Gas Bill',
    'Water Bill',
    'Incidental Fees',
  ],
};

const CATEGORY_LABELS = {
  materials: 'Materials and Tools',
  labour:    'Labour and Staffing',
  taxes:     'Taxes and Fees',
  utilities: 'Utilities',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeEmpty = () => ({
  materials:       Object.fromEntries(FIELDS.materials.map(f => [f, ''])),
  labour:          Object.fromEntries(FIELDS.labour.map(f    => [f, ''])),
  taxes:           Object.fromEntries(FIELDS.taxes.map(f     => [f, ''])),
  utilities:       Object.fromEntries(FIELDS.utilities.map(f => [f, ''])),
  reusability:     '',
  projectLifespan: '',
});

const parse = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const fmt   = (n) => n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isNum = (v) => v === '' || /^\d*\.?\d*$/.test(v);

// ─── Custom donut label ───────────────────────────────────────────────────────
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const shortName = name.split(' ').slice(0, 2).join(' ');
  return (
    <text x={x} y={y} fill="#D0D8E8" textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central" fontSize={10} fontWeight="500">
      <tspan x={x} dy="-0.4em">{shortName}</tspan>
      <tspan x={x} dy="1.3em">{(percent * 100).toFixed(0)}%</tspan>
    </text>
  );
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0F1E3D', border: '1px solid #2A3F6F',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: '#A0B4D0', marginBottom: 2 }}>{payload[0].name}</p>
      <p style={{ color: '#FFFFFF', fontWeight: 700, fontFamily: 'monospace' }}>
        ${fmt(payload[0].value)}
      </p>
    </div>
  );
};

// ─── Line chart tooltip ───────────────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0F1E3D', border: '1px solid #2A3F6F',
      borderRadius: 6, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: '#8BA8C8', marginBottom: 4, fontWeight: 600 }}>Project {label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontFamily: 'monospace', fontWeight: 700, margin: '2px 0' }}>
          {p.name}: ${fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Input field ──────────────────────────────────────────────────────────────
const Field = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{label}</label>
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
      <span style={{
        background: C.navy, color: C.white,
        padding: '8px 12px', fontSize: 14, fontWeight: 700,
        display: 'flex', alignItems: 'center',
      }}>$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => isNum(e.target.value) && onChange(e.target.value)}
        placeholder="0.00"
        style={{
          flex: 1, background: C.inputBg, border: 'none',
          padding: '8px 10px', fontSize: 14, color: '#1a1a1a',
          fontFamily: 'monospace', outline: 'none', minWidth: 0,
        }}
      />
    </div>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]     = useState('materials');
  const [costs, setCosts]             = useState(makeEmpty());
  const [projectCount, setProjectCount]       = useState(20);
  const [committedModelData, setCommittedModelData] = useState(null);
  const [visibleCount, setVisibleCount]             = useState(0);
  const [graphExpanded, setGraphExpanded]           = useState(false);
  const [chartHovered, setChartHovered]             = useState(false);
  const animFrameRef                                = useRef(null);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const catTotals = useMemo(() => ({
    materials: Object.values(costs.materials).reduce((s, v) => s + parse(v), 0),
    labour:    Object.values(costs.labour).reduce((s, v)    => s + parse(v), 0),
    taxes:     Object.values(costs.taxes).reduce((s, v)     => s + parse(v), 0),
    utilities: Object.values(costs.utilities).reduce((s, v) => s + parse(v), 0),
  }), [costs]);

  const grossTotal     = useMemo(() => Object.values(catTotals).reduce((s, v) => s + v, 0), [catTotals]);
  const reusePct       = Math.min(100, Math.max(0, parse(costs.reusability)));
  const reusableAmount = grossTotal * (reusePct / 100);
  const netTotal       = grossTotal - reusableAmount;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const setField = (cat, field, val) =>
    setCosts(prev => ({ ...prev, [cat]: { ...prev[cat], [field]: val } }));
  const setReuse = (val) => {
    if (!isNum(val)) return;
    if (val !== '' && parseFloat(val) > 100) return;
    setCosts(prev => ({ ...prev, reusability: val }));
  };
  const setLifespan = (val) => {
    if (!isNum(val)) return;
    setCosts(prev => ({ ...prev, projectLifespan: val }));
  };
  const generateGraph = () => {
    const data = costModelData;
    setCommittedModelData(data);
    setVisibleCount(0);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const duration = 3500;
    const start    = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setVisibleCount(Math.ceil(eased * data.length));
      if (progress < 1) animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  // ── Chart data — always shows overall 4-category breakdown ──────────────────
  const chartData = useMemo(() => [
    { name: 'Materials and Tools', value: catTotals.materials },
    { name: 'Labour and Staffing', value: catTotals.labour    },
    { name: 'Taxes and Fees',      value: catTotals.taxes     },
    { name: 'Utilities',            value: catTotals.utilities },
  ].filter(d => d.value > 0), [catTotals]);

  // ── Cost model data — TC(n) formula ─────────────────────────────────────────
  const costModelData = useMemo(() => {
    const x = Math.max(1, parse(costs.projectLifespan));
    return Array.from({ length: projectCount }, (_, i) => {
      const k      = i + 1;
      const cycles = Math.ceil(k / x);
      return {
        project:         k,
        newSolution:     cycles * grossTotal + (k - cycles) * netTotal,
        currentSolution: CURRENT_SOLUTION_COST * k,
      };
    });
  }, [projectCount, grossTotal, netTotal, costs.projectLifespan]);

  // ── Active tab display name ──────────────────────────────────────────────────
  const tabLabel = TABS.find(t => t.id === activeTab)?.label ?? '';

  // Split title into two lines at '&' or 'and' for the large display
  const titleLines = (() => {
    if (activeTab === 'overview')    return ['OVERVIEW', ''];
    if (activeTab === 'reusability') return ['Reusability', '%'];
    if (activeTab === 'materials')   return ['Materials', '& Tools'];
    if (activeTab === 'labour')      return ['Labour &', 'Staffing'];
    if (activeTab === 'taxes')       return ['Taxes &', 'Fees'];
    if (activeTab === 'utilities')   return ['Utilities', ''];
    if (activeTab === 'costmodel')   return ['Cost', 'Model'];
    return [tabLabel, ''];
  })();

  // ── Left panel content ───────────────────────────────────────────────────────
  const renderFields = () => {
    if (activeTab === 'overview') {
      const diff      = CURRENT_SOLUTION_COST - netTotal;
      const isCheaper = diff > 0;
      const isEqual   = diff === 0;
      const accent    = isEqual ? C.navy : isCheaper ? '#166534' : '#991B1B';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Category rows */}
          {Object.entries(catTotals).map(([id, total], i) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(27,45,90,0.1)', border: '2px solid rgba(27,45,90,0.2)',
                borderRadius: 7, padding: '8px 12px', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(27,45,90,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(27,45,90,0.1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i], flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{CATEGORY_LABELS[id]}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy, fontSize: 13 }}>${fmt(total)}</span>
            </button>
          ))}

          {/* Reusability + comparison in one compact block */}
          <div style={{
            marginTop: 4, padding: '8px 12px',
            background: 'rgba(27,45,90,0.08)', borderRadius: 7,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {[
              { label: 'Reusability %',  val: `${reusePct}%`,          color: C.navy    },
              { label: 'Recoverable',    val: `-$${fmt(reusableAmount)}`, color: '#2A7A2A' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.navy, opacity: 0.7 }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', color: r.color, fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* vs Current Solution */}
          <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.navy, opacity: 0.45,
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              vs Current Solution
            </p>
            {[
              { label: 'Current Solution',   val: `$${fmt(CURRENT_SOLUTION_COST)}` },
              { label: 'New Solution (net)',  val: `$${fmt(netTotal)}`              },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: C.navy, opacity: 0.7 }}>{r.label}</span>
                <span style={{ fontFamily: 'monospace', color: C.navy, fontWeight: 600 }}>{r.val}</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: isEqual ? 'rgba(27,45,90,0.1)' : isCheaper ? 'rgba(22,101,52,0.15)' : 'rgba(153,27,27,0.15)',
              border: `2px solid ${isEqual ? 'rgba(27,45,90,0.2)' : isCheaper ? 'rgba(22,101,52,0.4)' : 'rgba(153,27,27,0.4)'}`,
              borderRadius: 7, padding: '8px 12px',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: accent, opacity: 0.8 }}>
                  {isEqual ? 'No difference' : isCheaper ? 'Savings' : 'Costs more'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: accent, lineHeight: 1 }}>
                  {isCheaper ? '−' : isEqual ? '' : '+'}{`$${fmt(Math.abs(diff))}`}
                </p>
              </div>
              <span style={{
                width: 32, height: 32, borderRadius: '50%', background: accent, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {isEqual ? '=' : isCheaper ? '↓' : '↑'}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'reusability') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
              Reusability Percentage
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={costs.reusability}
                  onChange={e => setReuse(e.target.value)}
                  placeholder="0"
                  style={{
                    flex: 1, background: C.inputBg, border: 'none',
                    padding: '12px 14px', fontSize: 22, fontWeight: 700,
                    color: C.navy, fontFamily: 'monospace', outline: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: 28, fontWeight: 900, color: C.navy }}>%</span>
            </div>
            {/* Progress bar */}
            <div style={{ height: 8, background: 'rgba(27,45,90,0.2)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
              <div style={{
                width: `${reusePct}%`, height: '100%',
                background: C.navy, borderRadius: 4, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Project lifespan (x) input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
              Reusable for how many projects (x)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={costs.projectLifespan}
                  onChange={e => setLifespan(e.target.value)}
                  placeholder="1"
                  style={{
                    flex: 1, background: C.inputBg, border: 'none',
                    padding: '10px 14px', fontSize: 20, fontWeight: 700,
                    color: C.navy, fontFamily: 'monospace', outline: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.navy, opacity: 0.6 }}>proj.</span>
            </div>
          </div>

          {/* Breakdown */}
          <div style={{
            background: 'rgba(27,45,90,0.1)', borderRadius: 8, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {[
              { label: 'Gross Total',            val: `$${fmt(grossTotal)}`,     color: C.navy },
              { label: `Reusable (${reusePct}%)`, val: `-$${fmt(reusableAmount)}`, color: '#1A6A1A' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: C.navy, opacity: 0.75 }}>{row.label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: row.color }}>{row.val}</span>
              </div>
            ))}
            <div style={{ borderTop: `2px solid rgba(27,45,90,0.25)`, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: C.navy }}>Net Total</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: C.navy }}>${fmt(netTotal)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'costmodel') {
      const xLabel  = costs.projectLifespan ? Math.max(1, parse(costs.projectLifespan)) : '—';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* n slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Projects to model (n)</label>
              <input
                type="text"
                inputMode="numeric"
                value={projectCount}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  const n = Math.min(100, Math.max(1, Number(v) || 1));
                  setProjectCount(v === '' ? 1 : n);
                }}
                style={{
                  width: 52, background: C.inputBg, border: 'none', borderRadius: 6,
                  padding: '4px 8px', fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
                  color: C.navy, textAlign: 'center', outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              />
            </div>
            <input
              type="range" min={1} max={100} value={projectCount}
              onChange={e => setProjectCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.navy, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.navy, opacity: 0.45 }}>
              <span>1</span><span>50</span><span>100</span>
            </div>
          </div>

          {/* Formula variable summary */}
          <div style={{
            background: 'rgba(27,45,90,0.08)', borderRadius: 8, padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.navy, opacity: 0.45,
              textTransform: 'uppercase', letterSpacing: '0.1em' }}>Formula Variables</p>
            {[
              { sym: 'n',          val: projectCount,               note: 'total projects'      },
              { sym: 'x',          val: xLabel,                     note: 'lifespan per cycle'  },
              { sym: 'C_initial',  val: `$${fmt(grossTotal)}`,      note: 'gross total'         },
              { sym: 'C_reuse',    val: `$${fmt(netTotal)}`,        note: 'net total (reused)'  },
            ].map(r => (
              <div key={r.sym} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: C.navy, opacity: 0.65 }}>
                  <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{r.sym}</code>
                  {' '}— {r.note}
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={generateGraph}
            style={{
              width: '100%', padding: '13px',
              background: C.navy, color: C.yellow,
              border: `2px solid ${C.yellow}`,
              borderRadius: 8, fontWeight: 800, fontSize: 14,
              letterSpacing: '0.08em', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.yellow; e.currentTarget.style.color = C.navy; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.navy;   e.currentTarget.style.color = C.yellow; }}
          >
            GENERATE GRAPH
          </button>
        </div>
      );
    }

    // Regular category — 2-column grid
    const fields = FIELDS[activeTab] ?? [];
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px 20px',
      }}>
        {fields.map(field => (
          <Field
            key={field}
            label={field}
            value={costs[activeTab][field]}
            onChange={val => setField(activeTab, field, val)}
          />
        ))}
      </div>
    );
  };

  // ── Section total (shown in the Total bar) ───────────────────────────────────
  const displayTotal =
    activeTab === 'overview' || activeTab === 'reusability' || activeTab === 'costmodel'
      ? grossTotal
      : catTotals[activeTab] ?? 0;


  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: C.pageBg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      {/* Mini header row with title + clear button */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px 0', width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.navy, letterSpacing: '0.04em' }}>
            APS112 Team101 Budgeting
          </span>
          <span style={{ fontSize: 11, color: C.navy, opacity: 0.45, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            · Project Cost Management
          </span>
        </div>
        <button
          onClick={() => setCosts(makeEmpty())}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 16px',
            background: 'rgba(255,255,255,0.65)',
            color: C.navy, border: 'none', borderRadius: 6,
            fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.03em',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.65)'}
        >
          <RefreshCw size={12} />
          Clear Form
        </button>
      </div>

      {/* Tabs row */}
      <nav style={{ background: C.pageBg, paddingTop: 8, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  background: isActive ? C.navy : 'rgba(255,255,255,0.65)',
                  color: isActive ? C.white : C.navy,
                  border: 'none',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  transition: 'background 0.15s, color 0.15s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.65)'; }}}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, padding: '0 24px 20px',
        width: '100%', boxSizing: 'border-box',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
        minHeight: 0,
      }}>

        {/* Left — yellow panel */}
        <div style={{
          background: C.yellow, borderRadius: '0 12px 12px 12px',
          padding: 28, display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 4px 24px rgba(27,45,90,0.15)',
        }}>
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.navy, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {tabLabel}
            </h2>
            {activeTab !== 'overview' && activeTab !== 'reusability' && activeTab !== 'costmodel' && (
              <span style={{ fontSize: 12, color: C.navy, opacity: 0.6, fontWeight: 600 }}>
                Subtotal: ${fmt(catTotals[activeTab] ?? 0)}
              </span>
            )}
          </div>

          {/* Fields — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderFields()}
          </div>

          {/* Total bar */}
          <div style={{
            background: C.navy, borderRadius: 8,
            padding: '14px 20px', marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: C.white, fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>
              Total:
            </span>
            <span style={{ color: C.yellow, fontFamily: 'monospace', fontSize: 20, fontWeight: 800 }}>
              ${fmt(grossTotal)}
            </span>
          </div>
        </div>

        {/* Right — big title + chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, minHeight: 0 }}>

          {/* Large section title */}
          <div style={{ lineHeight: 1.05 }}>
            {titleLines.map((line, i) => line && (
              <div key={i} style={{
                fontSize: 'clamp(42px, 5.5vw, 72px)',
                fontWeight: 900, color: C.yellow,
                textShadow: '2px 3px 0 rgba(27,45,90,0.25)',
                letterSpacing: '-0.01em',
                fontFamily: 'system-ui, sans-serif',
              }}>
                {line}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div style={{
            flex: 1, background: C.navy, borderRadius: 12,
            padding: activeTab === 'costmodel' ? '20px 12px 12px' : '16px 8px 8px',
            boxShadow: '0 4px 24px rgba(27,45,90,0.25)',
            minHeight: 280,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}
          onMouseEnter={() => setChartHovered(true)}
          onMouseLeave={() => setChartHovered(false)}
          >
            {/* Expand button — only on hover */}
            {chartHovered && (activeTab === 'costmodel' ? !!committedModelData : chartData.length > 0) && (
              <button
                onClick={() => setGraphExpanded(true)}
                title="Expand graph"
                style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 2,
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                <Maximize2 size={14} color="#A8C4E0" />
              </button>
            )}
            {activeTab === 'costmodel' && !committedModelData ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', minHeight: 280, textAlign: 'center', gap: 12,
              }}>
                <svg width={100} height={100} viewBox="0 0 100 100" style={{ opacity: 0.12 }}>
                  <polyline points="10,80 30,55 50,60 70,30 90,20" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ color: '#6B8EAA', fontSize: 13 }}>Set your inputs and click Generate Graph</p>
              </div>
            ) : activeTab === 'costmodel' ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={committedModelData.slice(0, visibleCount)} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="project"
                    tick={{ fill: '#8BA8C8', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                    tickLine={false}
                    label={{ value: 'Projects (n)', position: 'insideBottom', offset: -14, fill: '#8BA8C8', fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: '#8BA8C8', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                    tickLine={false}
                    tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                    width={52}
                  />
                  <Tooltip content={<LineTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="newSolution"
                    name="New Solution"
                    stroke={C.yellow}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: C.yellow }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="currentSolution"
                    name="Current Solution"
                    stroke="#A8C4E0"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#A8C4E0' }}
                    isAnimationActive={true}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
                    formatter={v => <span style={{ color: '#A8C4E0' }}>{v}</span>}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : chartData.length > 0 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                    >
                      {chartData.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          stroke={C.navy}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      <tspan x="50%" dy="-0.5em" fontSize="10" fill="#8BA8C8">TOTAL</tspan>
                      <tspan x="50%" dy="1.6em" fontSize="13" fontWeight="700" fill="#FFFFFF" fontFamily="monospace">
                        ${fmt(grossTotal)}
                      </tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend below donut */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 16px', paddingBottom: 4 }}>
                  {chartData.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#A8C4E0', fontWeight: 500 }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%', minHeight: 280, textAlign: 'center',
              }}>
                <svg width={120} height={120} viewBox="0 0 120 120" style={{ opacity: 0.15 }}>
                  <circle cx="60" cy="60" r="44" fill="none" stroke="#FFFFFF" strokeWidth="14" strokeDasharray="10 7" />
                </svg>
                <p style={{ color: '#6B8EAA', fontSize: 13, marginTop: 12 }}>Enter values to see the chart</p>
              </div>
            )}
          </div>

          {/* Net total callout (shown when reusability > 0) */}
          {reusePct > 0 && activeTab !== 'comparison' && (
            <div style={{
              background: 'rgba(255,255,255,0.5)', borderRadius: 8,
              padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backdropFilter: 'blur(4px)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                Net Total after {reusePct}% reuse
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: C.navy }}>
                ${fmt(netTotal)}
              </span>
            </div>
          )}

        </div>
      </main>

      {/* ── Fullscreen graph overlay ───────────────────────────────────────── */}
      {graphExpanded && (
        <div
          onClick={() => setGraphExpanded(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(9,9,11,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.navy, borderRadius: 16,
              padding: '28px 24px 20px',
              width: '100%', maxWidth: 1100, maxHeight: '90vh',
              boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 12,
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setGraphExpanded(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={16} color="#A8C4E0" />
            </button>

            {activeTab === 'costmodel' ? (
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={committedModelData.slice(0, visibleCount)} margin={{ top: 12, right: 32, bottom: 32, left: 16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="project"
                    tick={{ fill: '#8BA8C8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                    tickLine={false}
                    label={{ value: 'Projects (n)', position: 'insideBottom', offset: -18, fill: '#8BA8C8', fontSize: 13 }}
                  />
                  <YAxis
                    tick={{ fill: '#8BA8C8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                    tickLine={false}
                    tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                    width={64}
                  />
                  <Tooltip content={<LineTooltip />} />
                  <Line type="monotone" dataKey="newSolution" name="New Solution"
                    stroke={C.yellow} strokeWidth={3} dot={false}
                    activeDot={{ r: 5, fill: C.yellow }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="currentSolution" name="Current Solution"
                    stroke="#A8C4E0" strokeWidth={2.5} dot={false}
                    activeDot={{ r: 5, fill: '#A8C4E0' }} isAnimationActive={false} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 12, fontSize: 13 }}
                    formatter={v => <span style={{ color: '#A8C4E0' }}>{v}</span>} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%"
                    innerRadius={100} outerRadius={170}
                    paddingAngle={2} dataKey="value"
                    label={renderCustomLabel} labelLine={false}>
                    {chartData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke={C.navy} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-0.5em" fontSize="13" fill="#8BA8C8">TOTAL</tspan>
                    <tspan x="50%" dy="1.8em" fontSize="18" fontWeight="700" fill="#FFFFFF" fontFamily="monospace">
                      ${fmt(grossTotal)}
                    </tspan>
                  </text>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
