output "db_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = aws_db_instance.coronagraph.endpoint
}

output "db_host" {
  description = "RDS instance hostname"
  value       = aws_db_instance.coronagraph.address
}

output "database_url" {
  description = "DATABASE_URL connection string for the application"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.coronagraph.address}:${var.db_port}/${var.db_name}"
  sensitive   = true
}

output "post_deploy_note" {
  description = "Reminder to enable pgvector after provisioning"
  value       = "Run against the database: CREATE EXTENSION IF NOT EXISTS vector;"
}
