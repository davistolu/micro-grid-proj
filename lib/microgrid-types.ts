/**
 * MICROGRID SIMULATION LABORATORY - TYPE DEFINITIONS
 * Topic: Model Predictive Energy Management of Solar-Diesel-Battery Microgrids Considering Battery Degradation
 */

export type Mode = 'MPC' | 'Rule EMS'
export type Weather = 'Clear' | 'Partly cloudy' | 'Cloudy' | 'Variable'
export type LoadProfileType = 'Commercial Outpost' | 'Remote Community' | 'Industrial Hospital' | 'Mining Camp'
export type BatteryChemistry = 'Lithium NMC (High Energy)' | 'Lithium LFP (High Cycle Life)'
export type RuleStrategy = 'Load Following' | 'Cycle Charging'

export interface StepTelemetry {
  time: number // hours (0.00 to 23.75)
  stepIndex: number
  
  // Power flows (kW)
  pv: number
  load: number
  diesel: number
  battery: number // >0 discharging, <0 charging
  curtailed: number
  unmet: number
  netPower: number // pv - load
  
  // Electrical & Environmental
  solarIrradiance: number // W/m^2
  panelTemp: number // °C
  inverterLoss: number // kW
  
  // Battery State
  soc: number // 0.0 - 1.0 (State of Charge)
  soh: number // 0.0 - 1.0 (State of Health)
  sohLossStep: number // delta SOH
  batteryVolts: number // V
  batteryCurrent: number // A
  batteryTemp: number // °C
  cRate: number
  dod: number // Depth of Discharge
  cycleFatigueFactor: number // Stress multiplier based on DoD & C-rate
  
  // Generator & Fuel
  dgRunning: boolean
  dgLoadingRatio: number // 0.0 - 1.0
  dgRampKw: number // rate of change (kW/step)
  fuelRate: number // Liters per 15-min step
  fuelHourlyRate: number // Liters / hour
  co2RateKg: number // kg CO2 / step
  
  // Cumulative financial & energy totals
  fuelCumulativeLiters: number
  fuelCostCumulative: number // USD
  degCostCumulative: number // USD
  startCostCumulative: number // USD
  totalCostCumulative: number // USD
  co2CumulativeKg: number // kg
  
  // MPC Optimizer Internals (when MPC active)
  mpcObjectiveJ?: number
  mpcPredictedSocTerminal?: number
  mpcDegCostPredicted?: number
  mpcForecastErrorKw?: number
}

export interface SimulationSummary {
  mode: Mode
  steps: StepTelemetry[]
  
  // Financial Indicators
  totalFuelLiters: number
  totalFuelCost: number
  totalDegradationCost: number
  totalStartCost: number
  totalOperatingCost: number
  
  // Battery Health & Lifetime
  initialSoc: number
  finalSoc: number
  initialSoh: number
  finalSoh: number
  sohLossPercent: number
  sohLossPpm: number
  equivalentFullCycles: number
  batteryThroughputKWh: number
  projectedBatteryLifeYears: number
  
  // Energy Flow & Generation
  totalPvGeneratedKWh: number
  totalPvUtilizedKWh: number
  totalDieselGeneratedKWh: number
  totalLoadServedKWh: number
  curtailedSolarKWh: number
  unmetLoadKWh: number
  systemRoundTripLossKWh: number
  
  // Generator Metrics
  dieselRuntimeHours: number
  dieselStarts: number
  averageDgEfficiency: number // kWh / L
  dgCapacityFactor: number // %
  totalCo2EmissionsKg: number
  
  // Key Performance Indicators (KPIs)
  renewableFraction: number // %
  systemEfficiency: number // %
  lossOfLoadProbability: number // %
  averageBatteryDoD: number
}

export interface SystemParameters {
  // Solar PV
  pvRatedCapacityKw: number
  pvTempCoeff: number // %/°C (e.g. -0.004)
  inverterEfficiency: number // 0.96
  
  // Diesel Generator
  dieselRatedCapacityKw: number
  dieselMinLoadRatio: number // e.g. 0.25 (to avoid wet stacking)
  dieselMaxRampKw: number // e.g. 35 kW / 15-min
  dgAlpha: number // L/h/kW_rated (idle fuel coeff)
  dgBeta: number // L/kWh (power fuel coeff)
  dgStartCost: number // USD per start
  co2PerLiterDiesel: number // kg CO2 / L (2.68 kg/L standard)
  fuelPricePerLiter: number // USD/L
  
  // Battery Energy Storage
  batteryCapacityKwh: number
  batteryMaxPowerKw: number
  batteryChemistry: BatteryChemistry
  batteryChargeEff: number
  batteryDischargeEff: number
  batteryInitialSoc: number
  batteryInitialSoh: number
  batteryMinSoc: number
  batteryMaxSoc: number
  batteryNominalVoltage: number // e.g. 400 V
  batteryReplacementCost: number // USD
  batteryRefCycleLife: number // Rated cycles at 80% DOD (e.g. 3500 for NMC, 6000 for LFP)
  
  // MPC Optimizer Weights
  horizonSteps: number // Prediction horizon (e.g. 16 steps = 4h)
  lambdaDegradation: number // Weight on battery degradation (0.0 to 1.0)
  weightFuel: number // Weight on fuel cost
  weightStartStop: number // Penalty on DG starts
  weightSocTerminal: number // Weight on terminal SOC tracking
  forecastNoiseRatio: number // Forecast uncertainty (0.0 = perfect, 0.20 = 20% noise)
  ruleStrategy: RuleStrategy
}
