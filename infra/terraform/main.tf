terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = "shelf-sync-design"
  region  = "us-central1"
}

resource "google_storage_bucket" "ciphertext" {
  name                        = "shelf-sync-design-ciphertext"
  location                    = "US"
  force_destroy               = false
  uniform_bucket_level_access = true
}

resource "google_sql_database_instance" "shelf" {
  name             = "shelf-sync-design"
  database_version = "POSTGRES_16"
  region           = "us-central1"
  settings {
    tier = "db-f1-micro"
  }
  deletion_protection = true
}

resource "google_secret_manager_secret" "sync_key_wrap" {
  secret_id = "shelf-sync-key-wrap"
  replication {
    auto {}
  }
}
