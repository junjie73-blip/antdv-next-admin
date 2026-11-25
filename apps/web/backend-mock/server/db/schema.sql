-- backend-mock 数据库初始化脚本（由 scripts/generate-schema-sql.mjs 生成，勿手改）
-- 单一真源：server/utils/db/sqlite/schema.ts
-- 执行方式：Nitro 启动时 useDatabase().exec(readFileSync('server/db/schema.sql'))
-- 全部语句可重复执行（CREATE IF NOT EXISTS / INSERT OR REPLACE）
-- seed_version = 9

-- ========== 建库级 PRAGMA ==========
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = OFF;

-- ---- __meta ----
CREATE TABLE IF NOT EXISTS __meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---- tb_user ----
CREATE TABLE IF NOT EXISTS tb_user (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_user_deleted ON tb_user(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_user_biz ON tb_user(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_created ON tb_user(created_at);

-- ---- tb_dept ----
CREATE TABLE IF NOT EXISTS tb_dept (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_dept_deleted ON tb_dept(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_dept_biz ON tb_dept(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_dept_created ON tb_dept(created_at);

-- ---- tb_role ----
CREATE TABLE IF NOT EXISTS tb_role (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_role_deleted ON tb_role(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_role_biz ON tb_role(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_role_created ON tb_role(created_at);

-- ---- tb_post ----
CREATE TABLE IF NOT EXISTS tb_post (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_post_deleted ON tb_post(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_post_biz ON tb_post(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_post_created ON tb_post(created_at);

-- ---- tb_dict_type ----
CREATE TABLE IF NOT EXISTS tb_dict_type (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_dict_type_deleted ON tb_dict_type(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_dict_type_biz ON tb_dict_type(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_dict_type_created ON tb_dict_type(created_at);

-- ---- tb_dict_item ----
CREATE TABLE IF NOT EXISTS tb_dict_item (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_dict_item_deleted ON tb_dict_item(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_dict_item_biz ON tb_dict_item(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_dict_item_created ON tb_dict_item(created_at);

-- ---- tb_notice ----
CREATE TABLE IF NOT EXISTS tb_notice (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_notice_deleted ON tb_notice(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_notice_biz ON tb_notice(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_notice_created ON tb_notice(created_at);

-- ---- tb_file ----
CREATE TABLE IF NOT EXISTS tb_file (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_file_deleted ON tb_file(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_file_biz ON tb_file(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_file_created ON tb_file(created_at);

-- ---- tb_online ----
CREATE TABLE IF NOT EXISTS tb_online (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_online_deleted ON tb_online(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_online_biz ON tb_online(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_online_created ON tb_online(created_at);

-- ---- tb_oper_log ----
CREATE TABLE IF NOT EXISTS tb_oper_log (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_oper_log_deleted ON tb_oper_log(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_oper_log_biz ON tb_oper_log(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_oper_log_created ON tb_oper_log(created_at);

-- ---- tb_login_log ----
CREATE TABLE IF NOT EXISTS tb_login_log (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_login_log_deleted ON tb_login_log(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_login_log_biz ON tb_login_log(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_login_log_created ON tb_login_log(created_at);

-- ---- tb_client_log ----
CREATE TABLE IF NOT EXISTS tb_client_log (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_client_log_deleted ON tb_client_log(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_client_log_biz ON tb_client_log(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_client_log_created ON tb_client_log(created_at);

-- ---- tb_captcha_log ----
CREATE TABLE IF NOT EXISTS tb_captcha_log (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_captcha_log_deleted ON tb_captcha_log(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_captcha_log_biz ON tb_captcha_log(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_captcha_log_created ON tb_captcha_log(created_at);

-- ---- tb_settings ----
CREATE TABLE IF NOT EXISTS tb_settings (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_settings_deleted ON tb_settings(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_settings_biz ON tb_settings(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_settings_created ON tb_settings(created_at);

-- ---- tb_config ----
CREATE TABLE IF NOT EXISTS tb_config (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_config_deleted ON tb_config(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_config_biz ON tb_config(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_config_created ON tb_config(created_at);

-- ---- tb_task ----
CREATE TABLE IF NOT EXISTS tb_task (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_task_deleted ON tb_task(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_task_biz ON tb_task(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_task_created ON tb_task(created_at);

-- ---- tb_approval ----
CREATE TABLE IF NOT EXISTS tb_approval (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_approval_deleted ON tb_approval(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_approval_biz ON tb_approval(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_approval_created ON tb_approval(created_at);

-- ---- tb_approval_group ----
CREATE TABLE IF NOT EXISTS tb_approval_group (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_approval_group_deleted ON tb_approval_group(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_approval_group_biz ON tb_approval_group(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_approval_group_created ON tb_approval_group(created_at);

-- ---- tb_approval_instance ----
CREATE TABLE IF NOT EXISTS tb_approval_instance (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_approval_instance_deleted ON tb_approval_instance(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_approval_instance_biz ON tb_approval_instance(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_approval_instance_created ON tb_approval_instance(created_at);

-- ---- tb_approval_level ----
CREATE TABLE IF NOT EXISTS tb_approval_level (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_approval_level_deleted ON tb_approval_level(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_approval_level_biz ON tb_approval_level(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_approval_level_created ON tb_approval_level(created_at);

-- ---- tb_ai_agent ----
CREATE TABLE IF NOT EXISTS tb_ai_agent (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_agent_deleted ON tb_ai_agent(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_agent_biz ON tb_ai_agent(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_agent_created ON tb_ai_agent(created_at);

-- ---- tb_ai_provider ----
CREATE TABLE IF NOT EXISTS tb_ai_provider (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_provider_deleted ON tb_ai_provider(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_provider_biz ON tb_ai_provider(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_provider_created ON tb_ai_provider(created_at);

-- ---- tb_ai_model ----
CREATE TABLE IF NOT EXISTS tb_ai_model (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_model_deleted ON tb_ai_model(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_model_biz ON tb_ai_model(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_model_created ON tb_ai_model(created_at);

-- ---- tb_ai_knowledge ----
CREATE TABLE IF NOT EXISTS tb_ai_knowledge (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_knowledge_deleted ON tb_ai_knowledge(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_knowledge_biz ON tb_ai_knowledge(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_knowledge_created ON tb_ai_knowledge(created_at);

-- ---- tb_ai_flow ----
CREATE TABLE IF NOT EXISTS tb_ai_flow (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_flow_deleted ON tb_ai_flow(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_flow_biz ON tb_ai_flow(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_flow_created ON tb_ai_flow(created_at);

-- ---- tb_table_demo ----
CREATE TABLE IF NOT EXISTS tb_table_demo (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_table_demo_deleted ON tb_table_demo(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_table_demo_biz ON tb_table_demo(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_table_demo_created ON tb_table_demo(created_at);

-- ---- tb_security_event ----
CREATE TABLE IF NOT EXISTS tb_security_event (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_event_deleted ON tb_security_event(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_event_biz ON tb_security_event(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_event_created ON tb_security_event(created_at);

-- ---- tb_security_alert ----
CREATE TABLE IF NOT EXISTS tb_security_alert (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_alert_deleted ON tb_security_alert(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_alert_biz ON tb_security_alert(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_alert_created ON tb_security_alert(created_at);

-- ---- tb_security_audit ----
CREATE TABLE IF NOT EXISTS tb_security_audit (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_audit_deleted ON tb_security_audit(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_audit_biz ON tb_security_audit(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_audit_created ON tb_security_audit(created_at);

-- ---- tb_security_mask_policy ----
CREATE TABLE IF NOT EXISTS tb_security_mask_policy (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_mask_policy_deleted ON tb_security_mask_policy(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_mask_policy_biz ON tb_security_mask_policy(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_mask_policy_created ON tb_security_mask_policy(created_at);

-- ---- tb_security_ai_policy ----
CREATE TABLE IF NOT EXISTS tb_security_ai_policy (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_policy_deleted ON tb_security_ai_policy(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_policy_biz ON tb_security_ai_policy(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_policy_created ON tb_security_ai_policy(created_at);

-- ---- tb_security_ai_call ----
CREATE TABLE IF NOT EXISTS tb_security_ai_call (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_call_deleted ON tb_security_ai_call(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_call_biz ON tb_security_ai_call(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_security_ai_call_created ON tb_security_ai_call(created_at);

-- ---- tb_ai_cp_provider ----
CREATE TABLE IF NOT EXISTS tb_ai_cp_provider (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_provider_deleted ON tb_ai_cp_provider(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_provider_biz ON tb_ai_cp_provider(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_provider_created ON tb_ai_cp_provider(created_at);

-- ---- tb_ai_cp_prompt ----
CREATE TABLE IF NOT EXISTS tb_ai_cp_prompt (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_prompt_deleted ON tb_ai_cp_prompt(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_prompt_biz ON tb_ai_cp_prompt(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_prompt_created ON tb_ai_cp_prompt(created_at);

-- ---- tb_ai_cp_context ----
CREATE TABLE IF NOT EXISTS tb_ai_cp_context (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_context_deleted ON tb_ai_cp_context(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_context_biz ON tb_ai_cp_context(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_context_created ON tb_ai_cp_context(created_at);

-- ---- tb_ai_cp_trace ----
CREATE TABLE IF NOT EXISTS tb_ai_cp_trace (
  _pk        TEXT PRIMARY KEY,
  biz_id     TEXT,
  data       TEXT NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_trace_deleted ON tb_ai_cp_trace(deleted);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_trace_biz ON tb_ai_cp_trace(biz_id);
CREATE INDEX IF NOT EXISTS idx_tb_ai_cp_trace_created ON tb_ai_cp_trace(created_at);

-- ---- tb_user_dept ----
CREATE TABLE IF NOT EXISTS tb_user_dept (
  _pk        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  dept_id    TEXT NOT NULL,
  payload    TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_user_dept_left ON tb_user_dept(user_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_dept_right ON tb_user_dept(dept_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_dept_deleted ON tb_user_dept(deleted);

-- ---- tb_user_role ----
CREATE TABLE IF NOT EXISTS tb_user_role (
  _pk        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  payload    TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_user_role_left ON tb_user_role(user_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_role_right ON tb_user_role(role_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_role_deleted ON tb_user_role(deleted);

-- ---- tb_user_post ----
CREATE TABLE IF NOT EXISTS tb_user_post (
  _pk        TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  post_id    TEXT NOT NULL,
  payload    TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_user_post_left ON tb_user_post(user_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_post_right ON tb_user_post(post_id);
CREATE INDEX IF NOT EXISTS idx_tb_user_post_deleted ON tb_user_post(deleted);

-- ---- tb_role_menu ----
CREATE TABLE IF NOT EXISTS tb_role_menu (
  _pk        TEXT PRIMARY KEY,
  role_id    TEXT NOT NULL,
  menu_id    TEXT NOT NULL,
  payload    TEXT,
  deleted    INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tb_role_menu_left ON tb_role_menu(role_id);
CREATE INDEX IF NOT EXISTS idx_tb_role_menu_right ON tb_role_menu(menu_id);
CREATE INDEX IF NOT EXISTS idx_tb_role_menu_deleted ON tb_role_menu(deleted);

-- ========== 初始化元数据 ==========
INSERT OR REPLACE INTO __meta (key, value) VALUES ('seed_version', '9');
