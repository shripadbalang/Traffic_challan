export type UserRole = 'owner' | 'citizen' | 'officer' | 'admin';

export interface User {
  id: string | number;
  fullName: string;
  email: string;
  mobileNumber?: string;
  role: UserRole;
  isVerified?: boolean;
  createdAt?: string;
  badgeNumber?: string;
  station?: string;
  officerId?: string;
  jurisdiction?: string;
}

export interface Vehicle {
  id: string | number;
  plateNumber: string;
  vehicleType: string;
  model: string;
  rtoCode: string;
  ownerId?: string | number;
  ownerName?: string;
  ownerMobile?: string;
  maskedMobile?: string;
  maskedEmail?: string;
}

export type ChallanStatus = 'pending' | 'paid' | 'disputed' | 'cancelled';
export type DetectionSource = 'ai' | 'manual' | 'speed_camera';

export interface BoundingBox {
  label: string;
  confidence: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] or [x, y, w, h] normalized
  color?: string;
}

export interface EvidenceItem {
  filePath: string;
  fileType: 'image' | 'video';
  annotations?: BoundingBox[];
  capturedAt?: string;
  cameraLocation?: string;
}

export interface Challan {
  id: string;
  vehiclePlate: string;
  vehicleModel?: string;
  violation: string;
  violationCode: string;
  fineAmount: number;
  status: ChallanStatus;
  detectionSource?: DetectionSource;
  aiConfidenceScore?: number;
  violationDatetime: string;
  location: string;
  latitude?: number;
  longitude?: number;
  paymentDate?: string | null;
  hasEvidence?: boolean;
  evidenceUrl?: string | null;
  evidenceType?: 'image' | 'video' | null;
  evidenceMissingReason?: string | null;
  evidence?: EvidenceItem[];
  payment?: {
    paymentId: string;
    amount: number;
    paidAt: string;
    method: string;
    receiptPdfPath?: string;
  };
  notes?: string | null;
  violationsBreakdown?: {
    is_combined?: boolean;
    violations?: Array<{
      code: string;
      name: string;
      fine: number;
      legal_section?: string;
    }>;
    original_total?: number;
    special_discount?: number;
    final_amount?: number;
    rule_applied?: string;
  } | null;
  disputeReason?: string;
  disputeStatus?: 'under_review' | 'approved' | 'rejected';
}

export interface AnalyticsData {
  totalChallans: number;
  totalRevenue: number;
  pendingCount: number;
  paidCount: number;
  disputedCount: number;
  collectionRate: number;
  aiAccuracy: number;
  byViolationType: { type: string; count: number; fineTotal: number }[];
  weeklyTrend: { week: string; count: number; revenue: number }[];
  hotspots: { location: string; latitude: number; longitude: number; count: number }[];
  repeatOffenders: {
    plateNumber: string;
    ownerName: string;
    totalViolations: number;
    unpaidAmount: number;
    riskScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
}

export interface DetectionResult {
  message: string;
  plateNumber: string;
  plateConfidence: number;
  violationsFound: string[];
  boxes: BoundingBox[];
  evidenceUrl: string;
  matchedVehicle?: Vehicle;
  challanId?: string;
}

export interface AdminDashboardStats {
  total_owners: number;
  total_vehicles: number;
  total_officers: number;
  active_officers: number;
  total_challans: number;
  unpaid_challans: number;
  paid_challans: number;
  disputed_challans: number;
  cancelled_challans: number;
  overdue_challans: number;
  total_fine_amount: number;
  total_collected_amount: number;
  challans_today: number;
  violations_today: number;
  payments_today_amount: number;
  payments_today_count: number;
  active_officers_today: number;
  ai_challans_count: number;
  manual_challans_count: number;
  recent_activity: {
    id: string;
    action: string;
    user_email: string;
    target: string;
    details: string;
    status: string;
    created_at: string | null;
  }[];
}

export interface AdminOfficer {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  badge_number: string;
  station: string;
  jurisdiction: string;
  is_active: boolean;
  violations_captured: number;
  challans_generated: number;
  challans_today: number;
  last_activity: string | null;
  created_at: string | null;
}

export interface AdminOwner {
  id: string;
  full_name: string;
  mobile_number: string | null;
  email: string | null;
  is_verified: boolean;
  created_at: string | null;
  linked_vehicles_count: number;
  total_challans: number;
  unpaid_challans: number;
  total_fines: number;
}

export interface AdminVehicle {
  id: string;
  plate_number: string;
  vehicle_type: string;
  model: string;
  rto_code: string;
  registered_mobile: string | null;
  owner_name: string;
  owner_email?: string | null;
  owner_mobile?: string | null;
  owner_id: string | null;
  total_challans: number;
  pending_challans: number;
  pending_fine_amount: number;
  registration_date: string | null;
}

export interface AdminPayment {
  id: string;
  challan_id: string;
  vehicle_plate: string;
  owner_name: string;
  amount: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  transaction_id: string;
  receipt_pdf_path: string | null;
  receipt_qr_path: string | null;
  paid_at: string | null;
}

export interface AdminAuditLog {
  id: string;
  user_id: string | null;
  user_email: string;
  user_role: string;
  action: string;
  target_resource: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  status: string;
  created_at: string | null;
}

export interface AdminSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string | null;
}

export interface AdminAIMonitoring {
  total_detections: number;
  average_confidence: number;
  confidence_distribution: { high: number; medium: number; low: number };
  violation_breakdown: { violation: string; count: number }[];
  recent_detections: {
    id: string;
    vehicle_plate: string;
    violation: string;
    fine_amount: number;
    confidence: number | null;
    status: string;
    datetime: string | null;
    location: string | null;
    has_evidence: boolean;
    evidence_path: string | null;
  }[];
}

