import mongoose from 'mongoose';

// ─── 1. Work Center Schema ───────────────────────────────────────
const workCenterSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: true },
  type: {
    type: String,
    enum: ['machine', 'assembly_line', 'manual_station', 'packaging', 'quality_lab'],
    default: 'machine'
  },
  capacityHoursPerDay: { type: Number, default: 8 },
  efficiencyRatePercent: { type: Number, default: 95 },
  hourlyLaborRate: { type: Number, default: 45 }, // SAR / hr
  hourlyMachineRate: { type: Number, default: 80 }, // SAR / hr
  oeeTarget: { type: Number, default: 85 }, // Target OEE %
  status: {
    type: String,
    enum: ['active', 'idle', 'in_use', 'maintenance', 'offline'],
    default: 'active'
  },
  currentWorkOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkOrder', default: null },
  maintenanceNotes: { type: String, default: '' },
  lastMaintenanceDate: { type: Date },
  nextMaintenanceDate: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

workCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });

// ─── 2. Routing & Operations Schema ───────────────────────────────
const routingOperationSchema = new mongoose.Schema({
  sequenceNo: { type: Number, required: true }, // e.g. 10, 20, 30
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: true },
  workCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkCenter', required: true },
  setupTimeMinutes: { type: Number, default: 15 },
  runTimePerUnitMinutes: { type: Number, default: 5 },
  cleanupTimeMinutes: { type: Number, default: 10 },
  laborCount: { type: Number, default: 1 },
  isMandatoryInspection: { type: Boolean, default: false },
  checklistTemplate: [{ type: String }], // Checklist points
  notes: { type: String, default: '' }
}, { _id: true });

const routingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  version: { type: String, default: '1.0' },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
  operations: [routingOperationSchema],
  totalStandardTimeMinutes: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

routingSchema.index({ tenantId: 1, code: 1 }, { unique: true });

// ─── 3. Multi-Level BOM Schema ────────────────────────────────────
const bomComponentSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  componentType: {
    type: String,
    enum: ['raw_material', 'sub_assembly', 'phantom_item', 'consumable'],
    default: 'raw_material'
  },
  subBomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingBOM', default: null },
  quantity: { type: Number, required: true, min: 0.0001 },
  uom: { type: String, default: 'PCS' },
  scrapAllowancePercent: { type: Number, default: 0 }, // Expected scrap %
  costPerUnit: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { _id: true });

const byProductSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  expectedYieldQty: { type: Number, required: true, min: 0 },
  uom: { type: String, default: 'KG' },
  costAllocationPercent: { type: Number, default: 0 },
  isScrap: { type: Boolean, default: false },
  recoveryValuePerUnit: { type: Number, default: 0 }
}, { _id: true });

const bomRevisionSchema = new mongoose.Schema({
  version: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changeSummary: { type: String, required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const bomSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  bomNumber: { type: String, required: true },
  nameEn: { type: String, required: true },
  nameAr: { type: String, required: true },
  finishedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  version: { type: String, default: '1.0' },
  status: { type: String, enum: ['draft', 'active', 'under_review', 'archived'], default: 'active' },
  isMultiLevel: { type: Boolean, default: false },
  baseQuantity: { type: Number, default: 1 }, // Yield standard batch
  uom: { type: String, default: 'PCS' },
  routingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingRouting' },
  components: [bomComponentSchema],
  byProducts: [byProductSchema],
  revisionHistory: [bomRevisionSchema],
  estimatedMaterialCost: { type: Number, default: 0 },
  estimatedLaborCost: { type: Number, default: 0 },
  estimatedOverheadCost: { type: Number, default: 0 },
  totalStandardCost: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

bomSchema.index({ tenantId: 1, bomNumber: 1 }, { unique: true });

// ─── 4. Work Order Schema ─────────────────────────────────────────
const workOrderSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  orderNumber: { type: String, required: true },
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  salesOrderNumber: { type: String, default: '' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  bomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingBOM', required: true },
  bomVersion: { type: String, default: '1.0' },
  routingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingRouting' },
  
  quantityPlanned: { type: Number, required: true, min: 1 },
  quantityProduced: { type: Number, default: 0 },
  quantityScrapped: { type: Number, default: 0 },
  quantityRejected: { type: Number, default: 0 },
  
  status: {
    type: String,
    enum: ['draft', 'planned', 'released', 'in_progress', 'paused', 'quality_check', 'completed', 'cancelled'],
    default: 'planned',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  wipStage: {
    type: String,
    enum: ['kitting', 'in_production', 'qa_quarantine', 'packaging', 'finished_goods_transfer'],
    default: 'kitting'
  },

  lotNumber: { type: String, default: '', index: true },
  serialNumbers: [{ type: String }],
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },

  scheduledStartDate: { type: Date, required: true },
  scheduledEndDate: { type: Date, required: true },
  actualStartDate: { type: Date },
  actualEndDate: { type: Date },

  // Costing Breakdown (SAR)
  standardCostEstimated: { type: Number, default: 0 },
  actualMaterialCost: { type: Number, default: 0 },
  actualLaborCost: { type: Number, default: 0 },
  actualOverheadCost: { type: Number, default: 0 },
  totalActualCost: { type: Number, default: 0 },
  costVariance: { type: Number, default: 0 }, // Actual - Standard

  kittingStatus: {
    type: String,
    enum: ['pending', 'partially_issued', 'fully_issued'],
    default: 'pending'
  },
  issuedMaterials: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    requiredQty: { type: Number, default: 0 },
    issuedQty: { type: Number, default: 0 },
    uom: { type: String, default: 'PCS' },
    lotBatchNumber: { type: String, default: '' },
    issuedAt: { type: Date }
  }],

  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

workOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

// ─── 5. Job Card & Real-Time Shop Floor Control ───────────────────
const jobCardSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  jobCardNumber: { type: String, required: true },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkOrder', required: true, index: true },
  operationSequence: { type: Number, required: true },
  operationName: { type: String, required: true },
  workCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkCenter', required: true },
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  operatorName: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },

  quantityInput: { type: Number, default: 0 },
  quantityOutput: { type: Number, default: 0 },
  quantityRejected: { type: Number, default: 0 },

  standardRunTimeMinutes: { type: Number, default: 0 },
  actualRunTimeMinutes: { type: Number, default: 0 },
  startTime: { type: Date },
  endTime: { type: Date },
  lastStartedAt: { type: Date },

  downtimeLogs: [{
    reason: {
      type: String,
      enum: ['machine_breakdown', 'tool_wear', 'material_shortage', 'operator_break', 'power_outage', 'maintenance', 'other'],
      default: 'machine_breakdown'
    },
    durationMinutes: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    loggedAt: { type: Date, default: Date.now }
  }],

  notes: { type: String, default: '' }
}, { timestamps: true });

jobCardSchema.index({ tenantId: 1, jobCardNumber: 1 }, { unique: true });

// ─── 6. Quality Assurance & Inspection (QA/QC) ────────────────────
const qualityInspectionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  inspectionNumber: { type: String, required: true },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkOrder', required: true, index: true },
  jobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingJobCard' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  lotNumber: { type: String, default: '' },
  
  stage: {
    type: String,
    enum: ['raw_material_incoming', 'in_process', 'post_machining', 'final_packaging'],
    default: 'in_process'
  },
  inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inspectorName: { type: String, default: '' },
  inspectionDate: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ['pending', 'passed', 'conditional_pass', 'failed', 'quarantined'],
    default: 'passed'
  },

  checklistResults: [{
    itemEn: { type: String, required: true },
    itemAr: { type: String, required: true },
    criteria: { type: String, default: '' },
    standardValue: { type: String, default: '' },
    actualValue: { type: String, default: '' },
    passed: { type: Boolean, default: true },
    notes: { type: String, default: '' }
  }],

  sampleSize: { type: Number, default: 10 },
  defectsFound: { type: Number, default: 0 },
  actionTaken: {
    type: String,
    enum: ['accepted', 'rework', 'scrap', 'quarantine'],
    default: 'accepted'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

qualityInspectionSchema.index({ tenantId: 1, inspectionNumber: 1 }, { unique: true });

// ─── 7. Non-Conformance Report (NCR) ──────────────────────────────
const ncrSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  ncrNumber: { type: String, required: true },
  workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManufacturingWorkOrder', required: true },
  lotNumber: { type: String, default: '' },
  detectedStage: { type: String, default: 'Assembly' },
  
  defectCategory: {
    type: String,
    enum: ['dimensional', 'material_flaw', 'assembly_error', 'contamination', 'packaging', 'functional_failure'],
    default: 'dimensional'
  },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    default: 'major'
  },
  
  quarantineQuantity: { type: Number, required: true, default: 1 },
  reworkCostEstimated: { type: Number, default: 0 },
  scrapCostEstimated: { type: Number, default: 0 },
  
  disposition: {
    type: String,
    enum: ['pending_review', 'rework', 'scrap', 'use_as_is', 'return_to_vendor'],
    default: 'pending_review'
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved', 'closed'],
    default: 'open'
  },
  
  rootCauseAnalysis: { type: String, default: '' },
  correctiveAction: { type: String, default: '' },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date }
}, { timestamps: true });

ncrSchema.index({ tenantId: 1, ncrNumber: 1 }, { unique: true });

// ─── 8. Master Production Schedule (MPS) ──────────────────────────
const mpsRecordSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  periodYear: { type: Number, required: true },
  periodMonth: { type: Number, required: true },
  weekNumber: { type: Number, default: 1 },
  
  forecastDemandQty: { type: Number, default: 0 },
  confirmedSalesOrdersQty: { type: Number, default: 0 },
  currentStockOnHand: { type: Number, default: 0 },
  plannedProductionQty: { type: Number, default: 0 },
  availableToPromiseQty: { type: Number, default: 0 },
  
  status: {
    type: String,
    enum: ['draft', 'approved', 'in_execution', 'closed'],
    default: 'draft'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

mpsRecordSchema.index({ tenantId: 1, productId: 1, periodYear: 1, periodMonth: 1, weekNumber: 1 }, { unique: true });

export const ManufacturingWorkCenter = mongoose.model('ManufacturingWorkCenter', workCenterSchema);
export const ManufacturingRouting = mongoose.model('ManufacturingRouting', routingSchema);
export const ManufacturingBOM = mongoose.model('ManufacturingBOM', bomSchema);
export const ManufacturingWorkOrder = mongoose.model('ManufacturingWorkOrder', workOrderSchema);
export const ManufacturingJobCard = mongoose.model('ManufacturingJobCard', jobCardSchema);
export const ManufacturingQualityInspection = mongoose.model('ManufacturingQualityInspection', qualityInspectionSchema);
export const ManufacturingNCR = mongoose.model('ManufacturingNCR', ncrSchema);
export const ManufacturingMPS = mongoose.model('ManufacturingMPS', mpsRecordSchema);
