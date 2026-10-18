-- Run this in the Supabase SQL editor (or via psql against your Supabase DATABASE_URL)
-- to set up the schema. SQLAlchemy models in app/models.py mirror this exactly.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('citizen', 'officer', 'admin');
CREATE TYPE detection_source AS ENUM ('ai', 'manual');
CREATE TYPE challan_status AS ENUM ('pending', 'paid', 'disputed', 'cancelled');
CREATE TYPE notification_channel AS ENUM ('email', 'in_app', 'sms');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR NOT NULL,
    mobile_number VARCHAR UNIQUE,
    email VARCHAR UNIQUE,
    password_hash VARCHAR,
    role user_role NOT NULL DEFAULT 'citizen',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id),
    vehicle_type VARCHAR NOT NULL,
    model VARCHAR,
    rto_code VARCHAR,
    registration_date TIMESTAMP
);

CREATE TABLE officers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    badge_number VARCHAR UNIQUE NOT NULL,
    station VARCHAR,
    jurisdiction VARCHAR
);

CREATE TABLE violation_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    base_fine_amount NUMERIC(10, 2) NOT NULL,
    legal_section VARCHAR
);

CREATE TABLE challans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    violation_type_id UUID NOT NULL REFERENCES violation_types(id),
    officer_id UUID REFERENCES officers(id),
    detection_source detection_source NOT NULL,
    fine_amount NUMERIC(10, 2) NOT NULL,
    status challan_status NOT NULL DEFAULT 'pending',
    ai_confidence_score FLOAT,
    violation_datetime TIMESTAMP NOT NULL DEFAULT now(),
    location VARCHAR,
    latitude FLOAT,
    longitude FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challan_id UUID NOT NULL REFERENCES challans(id),
    file_path VARCHAR NOT NULL,
    file_type VARCHAR NOT NULL,
    ai_annotations_json TEXT
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challan_id UUID NOT NULL REFERENCES challans(id),
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'initiated',
    razorpay_order_id VARCHAR,
    razorpay_payment_id VARCHAR,
    receipt_qr_path VARCHAR,
    receipt_pdf_path VARCHAR,
    paid_at TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challan_id UUID NOT NULL REFERENCES challans(id),
    user_id UUID NOT NULL REFERENCES users(id),
    channel notification_channel NOT NULL,
    status VARCHAR DEFAULT 'sent',
    message TEXT,
    sent_at TIMESTAMP DEFAULT now()
);

CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX idx_challans_vehicle ON challans(vehicle_id);
CREATE INDEX idx_otp_mobile ON otp_codes(mobile_number);

-- ============ ROW LEVEL SECURITY (RLS) ============
-- Protect tables against direct PostgREST / anon client key access in Supabase
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- ============ SEED DATA ============

-- Violation types (fine amounts approximate Maharashtra MV Act 2019 amendment ranges — adjust as needed)
INSERT INTO violation_types (code, name, base_fine_amount, legal_section) VALUES
('NO_HELMET', 'Riding without helmet', 500.00, 'Section 194D, MV Act'),
('MOBILE_PHONE_USAGE', 'Using mobile phone while driving', 1000.00, 'Section 184, MV Act'),
('WRONG_SIDE_DRIVING', 'Wrong-side / against traffic driving', 1500.00, 'Section 177, MV Act'),
('TRIPLE_RIDING', 'Triple riding on two-wheeler', 1000.00, 'Section 128, MV Act');

-- Sample admin + officer accounts (password = "Admin@123" / "Officer@123" — hash these properly at signup time;
-- these INSERTs are placeholders, use the /auth endpoints or a seed script to create real hashed accounts instead)

-- Sample mock Vahan vehicles for demo purposes (matching test-assets and demo scenarios)
-- Run `python -m scripts.seed_demo_data` to automatically create citizen accounts, link owners, and seed sample challans.
INSERT INTO vehicles (plate_number, vehicle_type, model, rto_code) VALUES
('MH12AB1234', 'motorcycle', 'Honda Activa 6G', 'MH12'),
('MH14CD5678', 'motorcycle', 'Bajaj Pulsar 150', 'MH14'),
('MH37AB0940', 'motorcycle', 'Royal Enfield Classic 350', 'MH37'),
('MH01IJ7890', 'car', 'Tata Nexon EV', 'MH01'),
('MH20GH3456', 'motorcycle', 'TVS Apache RTR 160', 'MH20'),
('MH31EF9012', 'car', 'Maruti Suzuki Swift', 'MH31'),
('MH12XY4321', 'motorcycle', 'Hero Splendor Plus', 'MH12')
ON CONFLICT (plate_number) DO NOTHING;
