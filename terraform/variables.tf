variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "coronagraph"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "coronagraph"
}

variable "db_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Port for PostgreSQL"
  type        = number
  default     = 5432
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to connect to the database"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "publicly_accessible" {
  description = "Whether the RDS instance should be publicly accessible (for dev/testing only)"
  type        = bool
  default     = false
}
