'use client'

import React, { useState } from 'react'
import {
  Activity,
  ArrowRight,
  BatteryCharging,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  Eye,
  FileText,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Network,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  SunMedium,
  Workflow,
  X,
  Zap
} from 'lucide-react'

interface MethodOfOperationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function MethodOfOperationModal({ isOpen, onClose }: MethodOfOperationModalProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'mpc_formulation' | 'rule_logic' | 'workflow'>('pipeline')
  const [activeStep, setActiveStep] = useState<number>(1)

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card wide-modal method-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1080px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(69, 212, 209, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cyan)'
              }}
            >
              <Workflow size={20} />
            </div>
            <div>
              <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
                SYSTEM CONTROLLER ARCHITECTURE &amp; OPERATIONAL PRINCIPLES
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                Method of Operation: Microgrid Energy Management System
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close-btn"
            title="Close Method of Operation"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8fa2ae',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* SUBHEADER TABS */}
        <div className="modal-action-bar" style={{ padding: '8px 20px', borderBottom: '1px solid #1a2a35' }}>
          <div className="modal-tabs">
            <button
              className={`modal-tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              <Workflow size={13} style={{ display: 'inline', marginRight: '6px' }} />
              Closed-Loop Control Pipeline
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'mpc_formulation' ? 'active' : ''}`}
              onClick={() => setActiveTab('mpc_formulation')}
            >
              <Cpu size={13} style={{ display: 'inline', marginRight: '6px' }} />
              MPC Mathematical Formulation
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'rule_logic' ? 'active' : ''}`}
              onClick={() => setActiveTab('rule_logic')}
            >
              <Layers size={13} style={{ display: 'inline', marginRight: '6px' }} />
              Rule-Based EMS Heuristics
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              <Play size={13} style={{ display: 'inline', marginRight: '6px' }} />
              User Operator Workflow
            </button>
          </div>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '20px', color: '#c3d3dd' }}>
          {/* TAB 1: CLOSED-LOOP PIPELINE */}
          {activeTab === 'pipeline' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0' }}>
                  Closed-Loop Receding-Horizon Dispatch Architecture
                </h3>
                <p style={{ fontSize: '12px', color: '#8ea2ae', margin: 0, lineHeight: '1.6' }}>
                  The Microgrid Energy Management System (EMS) operates on a synchronous discrete-time schedule (&Delta;t = 15 minutes, 96 intervals per diurnal cycle). At each sampling epoch k, the controller executes a 5-stage sequential decision process ensuring continuous power balance and optimal asset preservation.
                </p>
              </div>

              {/* INTERACTIVE FLOW PIPELINE STRIP */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '10px',
                  marginBottom: '20px'
                }}
              >
                {[
                  {
                    num: 1,
                    title: 'Disturbance Sensing',
                    icon: SunMedium,
                    short: 'Irradiance & Load Vectors',
                    color: 'var(--amber)'
                  },
                  {
                    num: 2,
                    title: 'State Estimation',
                    icon: BatteryCharging,
                    short: 'SOC, SOH & Thermal V',
                    color: 'var(--cyan)'
                  },
                  {
                    num: 3,
                    title: 'Predictive Dispatch',
                    icon: Cpu,
                    short: 'Np=16 Receding Horizon',
                    color: '#60a5fa'
                  },
                  {
                    num: 4,
                    title: 'Physical Actuation',
                    icon: Zap,
                    short: 'AC Bus Power Conservation',
                    color: 'var(--green)'
                  },
                  {
                    num: 5,
                    title: 'Telemetry & Digital Twin',
                    icon: Eye,
                    short: 'Degradation & 3D Feedback',
                    color: '#c084fc'
                  }
                ].map((s) => {
                  const Icon = s.icon
                  const isSelected = activeStep === s.num
                  return (
                    <div
                      key={s.num}
                      onClick={() => setActiveStep(s.num)}
                      style={{
                        background: isSelected ? 'rgba(69, 212, 209, 0.12)' : '#0b161f',
                        border: `1px solid ${isSelected ? 'var(--cyan)' : '#1a2a35'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isSelected ? 'var(--cyan)' : '#596e7a'
                          }}
                        >
                          STAGE 0{s.num}
                        </span>
                        <Icon size={16} style={{ color: s.color }} />
                      </div>
                      <b style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '4px' }}>
                        {s.title}
                      </b>
                      <span style={{ fontSize: '10px', color: '#7a8f9c', display: 'block', lineHeight: '1.3' }}>
                        {s.short}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* STAGE DEEP DIVE ACCORDION */}
              <div
                style={{
                  background: '#0a131b',
                  border: '1px solid #1c2e3d',
                  borderRadius: '10px',
                  padding: '18px',
                  marginBottom: '20px'
                }}
              >
                {activeStep === 1 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <SunMedium size={18} style={{ color: 'var(--amber)' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                        Stage 1: Environmental Disturbance Sensing &amp; Solar-Load Forecasting
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#9cb0be' }}>
                      At interval k, the simulator calculates extraterrestrial solar irradiance G0 and solar elevation angle &alpha; via astronomical geometry (Cooper declination model &amp; Kasten–Young air mass transmittance). Panel surface irradiance G_surf(t) is derived considering atmospheric cloud transmittance (Clear, Partly Cloudy, Cloudy, or Variable). Cell temperature derating is computed via IEC 61215 NOCT standard.
                    </p>
                    <div
                      style={{
                        background: '#070e14',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #15232d',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--amber)'
                      }}
                    >
                      P_pv(k) = P_pv,rated &times; (G_surf(k) / 1000 W/m&sup2;) &times; [1 + &gamma;_temp &times; (T_cell(k) - 25&deg;C)] &times; &eta;_inverter(P)
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <BatteryCharging size={18} style={{ color: 'var(--cyan)' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                        Stage 2: Battery Electrochemical State Estimation (SOC, SOH, DoD Fatigue)
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#9cb0be' }}>
                      The state of charge SOC(k) is tracked via continuous Coulomb integration with asymmetric charge/discharge coulombic efficiencies (&eta;_chg = 0.95, &eta;_dis = 0.95). Cell voltage is mapped via non-linear Open-Circuit Voltage curves Voc(SOC) for Lithium NMC (Vnom = 3.7 V/cell) or Lithium LFP (Vnom = 3.2 V/cell). Capacity fade is computed per step using a modified Arrhenius–W&ouml;hler semi-empirical model driven by cycle depth of discharge (DoD) and instantaneous C-rate stress factors.
                    </p>
                    <div
                      style={{
                        background: '#070e14',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #15232d',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--cyan)'
                      }}
                    >
                      SOC(k+1) = SOC(k) - [P_bat(k) / (V_pack &times; Q_rated)] &times; &eta;_coulomb &times; &Delta;t ; &Delta;SOH = f(DoD, C_rate, T_cell) / (2 &times; N_ref)
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Cpu size={18} style={{ color: '#60a5fa' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                        Stage 3: Receding-Horizon Predictive Optimization (MPC)
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#9cb0be' }}>
                      Under MPC mode, the optimizer looks ahead across Np = 16 intervals (4 hours). It evaluates dynamic trajectories of diesel dispatch and battery storage schedules to minimize a multi-objective cost functional comprising: (1) Brake-Specific Fuel Consumption, (2) Amortized electrochemical battery degradation weighted by &lambda;_deg, (3) Diesel engine start/stop penalties, and (4) Terminal state-of-charge tracking penalty. Only the control decision for the immediate interval k is committed to the physical microgrid bus.
                    </p>
                    <div
                      style={{
                        background: '#070e14',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #15232d',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: '#60a5fa'
                      }}
                    >
                      {'min J = sum_{i=0}^{Np-1} [ C_fuel(k+i) + lambda_deg * C_deg(k+i) + C_start(k+i) ] + W_term * (SOC(k+Np) - SOC*)^2'}
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Zap size={18} style={{ color: 'var(--green)' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                        Stage 4: Real-Time AC Bus Conservation &amp; Physical Actuation
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#9cb0be' }}>
                      Power conservation is enforced at the central 400V 3-phase AC bus. At all times: P_pv(k) + P_diesel(k) + P_bat,dis(k) = P_load(k) + P_bat,chg(k) + P_curtail(k). Diesel generator ramp limits (|&Delta;P_dg| &le; 35 kW/step) and minimum loading constraints (P_dg &ge; 0.25 P_rated to prevent low-temperature wet-stacking) are strictly satisfied.
                    </p>
                    <div
                      style={{
                        background: '#070e14',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #15232d',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--green)'
                      }}
                    >
                      {'sum P_generation(k) - sum P_demand(k) = 0.00 kW (Zero Unmet Load Tolerance)'}
                    </div>
                  </div>
                )}

                {activeStep === 5 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Eye size={18} style={{ color: '#c084fc' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>
                        Stage 5: Live Telemetry Logging, 3D Digital Twin &amp; Receding Horizon Shift
                      </h4>
                    </div>
                    <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#9cb0be' }}>
                      The state feedback variables (SOC(k+1), SOH(k+1), Fuel_cum, CO2_cum) are logged into the historical telemetry series and rendered live onto the WebGL 3D Digital Twin scene. Particle conduits dynamically visualize the exact energy flows, and generator smoke animations scale with instantaneous engine loading. The time window then advances to k+1, repeating the closed-loop optimization.
                    </p>
                    <div
                      style={{
                        background: '#070e14',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #15232d',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: '#c084fc'
                      }}
                    >
                      {'State Vector x(k+1) is fed back to Stage 1. Horizon rolls forward: [k+1, k+1+Np]'}
                    </div>
                  </div>
                )}
              </div>

              {/* ARCHITECTURE SUMMARY CALLOUT */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  fontSize: '11px'
                }}
              >
                <div style={{ background: '#0b161e', padding: '12px', borderRadius: '8px', border: '1px solid #182833' }}>
                  <b style={{ color: 'var(--cyan)', display: 'block', marginBottom: '4px' }}>Deterministic Disturbance</b>
                  Irradiance and load disturbance vectors are mathematically reproducible, ensuring scientific rigor and academic repeatability.
                </div>
                <div style={{ background: '#0b161e', padding: '12px', borderRadius: '8px', border: '1px solid #182833' }}>
                  <b style={{ color: 'var(--amber)', display: 'block', marginBottom: '4px' }}>Custom Physical Ratings</b>
                  Direct numerical typing allows simulating arbitrary real-world plants (e.g. 500 kW PV, 1000 kWh BESS, 300 kW DG) with instant re-convergence.
                </div>
                <div style={{ background: '#0b161e', padding: '12px', borderRadius: '8px', border: '1px solid #182833' }}>
                  <b style={{ color: 'var(--green)', display: 'block', marginBottom: '4px' }}>Dual Synchronous Benchmark</b>
                  Side-by-side execution against classical heuristic dispatch quantifies exact operational cost savings, fuel reduction, and battery life extension.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MPC FORMULATION */}
          {activeTab === 'mpc_formulation' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0' }}>
                  Degradation-Aware Model Predictive Control (MPC) Formulation
                </h3>
                <p style={{ fontSize: '12px', color: '#8ea2ae', margin: 0, lineHeight: '1.6' }}>
                  The predictive energy manager solves a constrained finite-horizon discrete-time optimization problem at each 15-minute epoch k over a prediction horizon of Np = 16 time steps (4.0 hours).
                </p>
              </div>

              {/* OBJECTIVE FUNCTION */}
              <div
                style={{
                  background: '#081118',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #1b2f3d',
                  marginBottom: '16px'
                }}
              >
                <span className="eyebrow" style={{ color: 'var(--cyan)', marginBottom: '6px' }}>
                  MATHEMATICAL OBJECTIVE FUNCTION
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: '#fff',
                    background: '#04090d',
                    padding: '12px',
                    borderRadius: '6px',
                    lineHeight: '1.6',
                    overflowX: 'auto',
                    border: '1px solid #14222c'
                  }}
                >
                  {'min J = sum_{i=0}^{Np-1} [ C_fuel(k+i) + lambda_deg * C_deg(k+i) + C_start(k+i) ] + W_term * (SOC(k+Np) - SOC*)^2'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '12px', fontSize: '11px', color: '#90a4b2' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>1. Fuel Cost Model (C_fuel):</strong>
                    <br />
                    {'F(P_dg) = (alpha * P_rated + beta * P_dg) * Delta_t'}
                    <br />
                    {'C_fuel = F(P_dg) * Price_diesel (alpha = 0.084 L/h/kW, beta = 0.246 L/kWh)'}
                  </div>
                  <div>
                    <strong style={{ color: '#fff' }}>2. Degradation Cost Model (C_deg):</strong>
                    <br />
                    {'C_deg = Delta_SOH(k) * C_battery_replacement'}
                    <br />
                    Evaluates Arrhenius thermal fatigue and W&ouml;hler depth-of-discharge (DoD) stress factor.
                  </div>
                  <div>
                    <strong style={{ color: '#fff' }}>3. Thermal Engine Start Penalty (C_start):</strong>
                    <br />
                    {'C_start = S_dg(k) * $4.50 (where S_dg = 1 if P_dg(k) > 0 and P_dg(k-1) == 0)'}
                    <br />
                    Penalizes unneeded cyclic starts to prevent thermal fatigue.
                  </div>
                  <div>
                    <strong style={{ color: '#fff' }}>4. Terminal SOC Target (W_term):</strong>
                    <br />
                    Soft penalty preserving reserve energy (SOC* = 0.50) at the horizon boundary so the battery is not myopically depleted.
                  </div>
                </div>
              </div>

              {/* OPERATIONAL CONSTRAINTS */}
              <div
                style={{
                  background: '#081118',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #1b2f3d',
                  marginBottom: '16px'
                }}
              >
                <span className="eyebrow" style={{ color: 'var(--amber)', marginBottom: '6px' }}>
                  PHYSICAL &amp; OPERATIONAL CONSTRAINTS
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '11px', color: '#90a4b2', marginTop: '8px' }}>
                  <div style={{ background: '#0e1c26', padding: '10px', borderRadius: '6px' }}>
                    <b style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>AC Bus Power Balance:</b>
                    {'P_pv(k) + P_dg(k) + P_bat,dis(k) = P_load(k) + P_bat,chg(k) + P_curtail(k)'}
                  </div>
                  <div style={{ background: '#0e1c26', padding: '10px', borderRadius: '6px' }}>
                    <b style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Diesel Operating Envelope:</b>
                    {'P_dg(k) = 0 OR 0.25 * P_rated <= P_dg(k) <= P_rated (Anti-wet-stacking)'}
                  </div>
                  <div style={{ background: '#0e1c26', padding: '10px', borderRadius: '6px' }}>
                    <b style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Diesel Ramp Limits:</b>
                    {'|P_dg(k) - P_dg(k-1)| <= Delta_P_ramp (<= 35 kW per 15-min)'}
                  </div>
                  <div style={{ background: '#0e1c26', padding: '10px', borderRadius: '6px' }}>
                    <b style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>BESS Safe Operating Area:</b>
                    {'SOC_min <= SOC(k) <= SOC_max | |P_bat(k)| <= P_bat,max'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULE LOGIC */}
          {activeTab === 'rule_logic' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0' }}>
                  Rule-Based Energy Management Heuristics (Benchmark Baseline)
                </h3>
                <p style={{ fontSize: '12px', color: '#8ea2ae', margin: 0, lineHeight: '1.6' }}>
                  In remote microgrids, industry-standard rule controllers execute deterministic heuristic decision trees without multi-step lookahead or battery degradation models. This simulator implements the two primary classical paradigms:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                {/* STRATEGY 1: LOAD FOLLOWING */}
                <div
                  style={{
                    background: '#09131a',
                    border: '1px solid #1a2c38',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="metric-badge" style={{ background: '#1e3845', color: 'var(--cyan)' }}>
                      DEFAULT BASELINE
                    </span>
                    <h4 style={{ margin: 0, fontSize: '13px', color: '#fff' }}>Load Following Strategy</h4>
                  </div>
                  <p style={{ fontSize: '11px', color: '#889da8', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                    The generator only produces power strictly sufficient to serve the net demand deficit. The battery is never charged from the diesel generator, only from surplus solar PV.
                  </p>
                  <div style={{ fontSize: '11px', color: '#adc2cf', lineHeight: '1.6' }}>
                    <b>Decision Sequence:</b>
                    <ol style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                      <li>Net Load calculated: P_net = P_load - P_pv.</li>
                      <li>If P_net &le; 0: Solar powers load directly. Excess solar charges battery up to P_bat,max and SOC_max. Generator stays OFF.</li>
                      <li>If P_net &gt; 0: Battery discharges to supply deficit.</li>
                      <li>If battery reaches SOC_min or P_bat,max: Diesel generator turns ON to supply the unserved balance, clamped to at least 0.25 P_rated.</li>
                    </ol>
                    <div style={{ marginTop: '8px', color: 'var(--amber)', fontSize: '10px' }}>
                      &warning; Weakness: Rapid low-load idling causes fuel inefficiency and deep battery depletion.
                    </div>
                  </div>
                </div>

                {/* STRATEGY 2: CYCLE CHARGING */}
                <div
                  style={{
                    background: '#09131a',
                    border: '1px solid #1a2c38',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="metric-badge" style={{ background: '#2d2417', color: 'var(--amber)' }}>
                      HEAVY RECHARGE
                    </span>
                    <h4 style={{ margin: 0, fontSize: '13px', color: '#fff' }}>Cycle Charging Strategy</h4>
                  </div>
                  <p style={{ fontSize: '11px', color: '#889da8', lineHeight: '1.5', margin: '0 0 10px 0' }}>
                    Whenever the diesel generator is required to start, it is commanded to operate at 100% of its rated capacity until the battery pack is recharged to a defined setpoint (SOC = 80%).
                  </p>
                  <div style={{ fontSize: '11px', color: '#adc2cf', lineHeight: '1.6' }}>
                    <b>Decision Sequence:</b>
                    <ol style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                      <li>If battery drops below SOC_min (15%), generator is started at 100% capacity.</li>
                      <li>Generator serves full load; surplus diesel power is pushed into the battery at maximum allowable charge rate.</li>
                      <li>Generator remains locked ON at high output until SOC &ge; 80%.</li>
                      <li>Once threshold is reached, generator shuts down and microgrid returns to solar/battery discharge mode.</li>
                    </ol>
                    <div style={{ marginTop: '8px', color: '#60a5fa', fontSize: '10px' }}>
                      &check; High generator loading efficiency, but causes unnecessary fuel burn when solar is imminent.
                    </div>
                  </div>
                </div>
              </div>

              {/* WHY MPC WINS TABLE */}
              <div
                style={{
                  background: '#071017',
                  border: '1px solid #162633',
                  borderRadius: '8px',
                  padding: '14px'
                }}
              >
                <b style={{ color: 'var(--cyan)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  Analytical Comparison: Why Degradation-Aware MPC Outperforms Heuristic Rules
                </b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px' }}>
                  <div style={{ background: '#0c1720', padding: '10px', borderRadius: '6px' }}>
                    <strong style={{ color: '#fff' }}>Pre-Emptive Solar Buffering:</strong>
                    <br />
                    Rule EMS charges battery with diesel right before midday solar peak, leading to curtailed solar. MPC foresees morning irradiance and holds battery capacity open for free solar photons.
                  </div>
                  <div style={{ background: '#0c1720', padding: '10px', borderRadius: '6px' }}>
                    <strong style={{ color: '#fff' }}>Engine Efficiency Sweet-Spot:</strong>
                    <br />
                    MPC operates the generator in its 75%–85% loading sweet-spot, achieving 28.1% thermal-to-electric efficiency vs 15.0% idling efficiency in Rule EMS.
                  </div>
                  <div style={{ background: '#0c1720', padding: '10px', borderRadius: '6px' }}>
                    <strong style={{ color: '#fff' }}>Anti-Fatigue Depth-of-Discharge:</strong>
                    <br />
                    Rule EMS allows the battery to hit 15% SOC, where W&ouml;hler fatigue multiplies degradation by 2.24&times;. MPC keeps SOC buffered in the gentle 35%–80% plateau.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OPERATOR WORKFLOW */}
          {activeTab === 'workflow' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', color: '#fff', margin: '0 0 6px 0' }}>
                  Interactive Simulator Operator Guide &amp; Research Workflows
                </h3>
                <p style={{ fontSize: '12px', color: '#8ea2ae', margin: 0, lineHeight: '1.6' }}>
                  Follow these step-by-step procedures to conduct academic studies, sensitivity analyses, and physical equipment sizing evaluations.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {[
                  {
                    step: '1. Custom Equipment Sizing & Dual-Mode Parameter Inputs',
                    desc: 'In the left sidebar, every parameter features direct numerical keyboard typing paired with a synchronized slider: PV Rated Capacity (kW), Diesel Generator Capacity (kW), DG Minimum Loading (%), DG Ramp Bound (kW/15m), BESS Capacity (kWh), BESS Peak Inverter Power (kW), Safe SOC Operating Window (%), Fuel Price ($/L), MPC Degradation Weight (λ_deg), Prediction Horizon (N_p), and Forecast Noise (%). The engine immediately re-optimizes the entire 24-hour dispatch horizon upon any change.',
                    tip: 'Tip: You can directly type exact engineering specifications or use the synchronized sliders and industrial presets.'
                  },
                  {
                    step: '2. Environmental Disturbances & Archetype Selection',
                    desc: 'Select your weather irradiance regime (Clear Sky, Passing Clouds, Overcast, or Variable Turbulence) and consumer load archetype (Commercial Outpost, Remote Village, Industrial Hospital, or Mining Camp). Adjust load scaling percentage directly via number input or slider to test under-demand or peak overload conditions.',
                    tip: 'Tip: Testing under "Variable" weather provides the ultimate benchmark for MPC forecast robustness.'
                  },
                  {
                    step: '3. Simulation Execution, Scrubbing Controls & 3D Lighting',
                    desc: 'Click "Run Simulation" to watch the dynamic dispatch unfold at your configured speed (0.5× to 10×) or type a target runtime in seconds. Scrub anytime by typing an exact discrete step (Step 1..96) into the step box, or drag the continuous scrubber slider. In the 3D scene, toggle between Daylight Inspection Mode (clear midday illumination) and Diurnal Sun Cycle (24h celestial orbit with architectural night lighting).',
                    tip: 'Tip: Use camera POV buttons (Aerial, Solar, BESS, Genset, AC Bus, Load) to focus on individual compound subsystems.'
                  },
                  {
                    step: '4. Dual Synchronous Benchmark Inspection',
                    desc: 'Click the "Dual Compare" button in the topbar to split the telemetry bus and view MPC vs Rule EMS side-by-side at the exact same time step. Inspect the lower comparative charts (Cost, SOC, Aging Fatigue Factor, Carbon Emissions).',
                    tip: 'Tip: Notice how MPC stabilizes battery SOH while Rule EMS causes steep capacity fade.'
                  },
                  {
                    step: '5. Exporting Academic Manuscripts & Code',
                    desc: 'Click "Paper (.docx)" or "Academic Reports" to open the research export modal. You can download a complete IEEE/Elsevier-formatted Microsoft Word paper (.docx), Markdown research report (.md), production-grade MATLAB/Simulink script (.m), raw CSV telemetry, or JSON payload with zero guesswork.',
                    tip: 'Tip: Use the "Download Complete Research Bundle" button to download all 5 research artifacts in a single click.'
                  }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#0a131b',
                      border: '1px solid #192936',
                      borderRadius: '8px',
                      padding: '14px'
                    }}
                  >
                    <b style={{ color: 'var(--cyan)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                      {item.step}
                    </b>
                    <p style={{ fontSize: '11px', color: '#9bb0bd', margin: '0 0 6px 0', lineHeight: '1.5' }}>
                      {item.desc}
                    </p>
                    <div style={{ fontSize: '10px', color: 'var(--amber)' }}>
                      {item.tip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #1a2a35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#889da7' }}>
            <CheckCircle2 size={15} style={{ color: 'var(--green)' }} />
            <span>Method of operation follows IEEE Std 2030.7-2017 specification for microgrid energy management.</span>
          </div>
          <button
            onClick={onClose}
            className="primary"
            style={{ padding: '8px 18px', fontSize: '12px' }}
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  )
}
