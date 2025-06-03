-- src/database/schema.sql

CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE client_connections (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id),
  connection_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders_raw_shopee (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT now(),
  client_id INT REFERENCES clients(id),
  raw_data JSONB NOT NULL,
  order_id TEXT,
  is_processed BOOLEAN DEFAULT FALSE
);

CREATE TABLE orders_raw_meli (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT now(),
  client_id INT REFERENCES clients(id),
  raw_data JSONB NOT NULL,
  order_id TEXT,
  is_processed BOOLEAN DEFAULT FALSE
);

CREATE TABLE orders_normalized (
  id BIGSERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id),
  connection_name TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  status TEXT,
  total_amount NUMERIC,
  order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exemplo de inserção (apenas para referência, não será executado automaticamente)
-- INSERT INTO clients (name, created_at)
-- VALUES ('Leve Week Magazine', NOW())
-- RETURNING id;