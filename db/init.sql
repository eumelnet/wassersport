CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CMS: editable pages composed of ordered block lists
--
-- Two block columns:
--   blocks_json       = live / published version (shown to public)
--   draft_blocks_json = current working copy (NULL means no draft pending)
-- Publishing = copy draft_blocks_json → blocks_json, clear draft.
CREATE TABLE IF NOT EXISTS pages (
  slug              VARCHAR(64)  PRIMARY KEY,
  title             VARCHAR(200) NOT NULL,
  requires_auth     TINYINT(1)   NOT NULL DEFAULT 0,
  is_listed         TINYINT(1)   NOT NULL DEFAULT 1,
  blocks_json       JSON         NOT NULL,
  draft_blocks_json JSON         NULL,
  draft_title       VARCHAR(200) NULL,
  published_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  draft_updated_at  TIMESTAMP    NULL DEFAULT NULL,
  updated_by        INT UNSIGNED NULL,
  draft_updated_by  INT UNSIGNED NULL,
  INDEX idx_published_at (published_at)
);

CREATE TABLE IF NOT EXISTS page_revisions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(64)  NOT NULL,
  title       VARCHAR(200) NOT NULL,
  blocks_json JSON         NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  created_by  INT UNSIGNED NULL,
  INDEX idx_slug_created (slug, created_at)
);

CREATE TABLE IF NOT EXISTS media (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename   VARCHAR(255) NOT NULL,
  orig_name  VARCHAR(255) NOT NULL,
  mime       VARCHAR(100) NOT NULL,
  width      INT NULL,
  height     INT NULL,
  bytes      INT UNSIGNED NULL,
  alt        VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  INDEX idx_created_at (created_at)
);

-- Site-wide settings (navigation, footer, branding) as key→json-value map
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  value_json  JSON NOT NULL,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex of the raw token
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires_at (expires_at)
);
