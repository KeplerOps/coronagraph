# -----------------------------------------------------------------------------
# VPC — use the default VPC to keep things simple and cheap
# -----------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# -----------------------------------------------------------------------------
# Security Group — allow PostgreSQL access
# -----------------------------------------------------------------------------
resource "aws_security_group" "coronagraph_db" {
  name        = "coronagraph-db"
  description = "Allow PostgreSQL access for Coronagraph"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "PostgreSQL"
    from_port   = var.db_port
    to_port     = var.db_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "coronagraph-db"
  }
}

# -----------------------------------------------------------------------------
# DB Subnet Group
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "coronagraph" {
  name       = "coronagraph"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "coronagraph"
  }
}

# -----------------------------------------------------------------------------
# Parameter Group — PostgreSQL 16 defaults (pgvector is installed via
# CREATE EXTENSION vector; no custom parameters needed to enable it)
# -----------------------------------------------------------------------------
resource "aws_db_parameter_group" "coronagraph_pg16" {
  name   = "coronagraph-pg16"
  family = "postgres16"

  description = "Coronagraph PostgreSQL 16 parameter group"

  # shared_preload_libraries is not required for pgvector on RDS —
  # the extension is available by default and activated with:
  #   CREATE EXTENSION IF NOT EXISTS vector;

  tags = {
    Name = "coronagraph-pg16"
  }
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL Instance
# -----------------------------------------------------------------------------
resource "aws_db_instance" "coronagraph" {
  identifier = "coronagraph"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = var.db_port

  parameter_group_name = aws_db_parameter_group.coronagraph_pg16.name
  db_subnet_group_name = aws_db_subnet_group.coronagraph.name
  vpc_security_group_ids = [aws_security_group.coronagraph_db.id]

  publicly_accessible    = var.publicly_accessible
  multi_az               = false
  skip_final_snapshot    = true
  deletion_protection    = false
  backup_retention_period = 7

  # Apply changes immediately in dev; set to false for production
  apply_immediately = true

  tags = {
    Name = "coronagraph"
  }
}
