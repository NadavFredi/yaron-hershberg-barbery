


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "supabase_migrations";


ALTER SCHEMA "supabase_migrations" OWNER TO "postgres";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."appointment_kind" AS ENUM (
    'business',
    'personal'
);


ALTER TYPE "public"."appointment_kind" OWNER TO "postgres";


CREATE TYPE "public"."appointment_status" AS ENUM (
    'pending',
    'scheduled',
    'completed',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."appointment_status" OWNER TO "postgres";


CREATE TYPE "public"."customer_class" AS ENUM (
    'new',
    'vip',
    'standard',
    'inactive'
);


ALTER TYPE "public"."customer_class" OWNER TO "postgres";


CREATE TYPE "public"."customer_gender" AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE "public"."customer_gender" OWNER TO "postgres";


CREATE TYPE "public"."debt_status" AS ENUM (
    'open',
    'partial',
    'paid'
);


ALTER TYPE "public"."debt_status" OWNER TO "postgres";


CREATE TYPE "public"."expiry_calculation_method" AS ENUM (
    'from_purchase_date',
    'from_first_usage'
);


ALTER TYPE "public"."expiry_calculation_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'paid',
    'partial'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."pin_reason" AS ENUM (
    'reschedule',
    'attention',
    'special',
    'date_change',
    'quick_access'
);


ALTER TYPE "public"."pin_reason" OWNER TO "postgres";


CREATE TYPE "public"."questionnaire_result" AS ENUM (
    'not_required',
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."questionnaire_result" OWNER TO "postgres";


CREATE TYPE "public"."service_category" AS ENUM (
    'grooming'
);


ALTER TYPE "public"."service_category" OWNER TO "postgres";


CREATE TYPE "public"."service_scope" AS ENUM (
    'grooming',
    'both'
);


ALTER TYPE "public"."service_scope" OWNER TO "postgres";


CREATE TYPE "public"."ticket_type_kind" AS ENUM (
    'entrances',
    'days'
);


ALTER TYPE "public"."ticket_type_kind" OWNER TO "postgres";


CREATE TYPE "public"."treatment_gender" AS ENUM (
    'male',
    'female',
    'unknown'
);


ALTER TYPE "public"."treatment_gender" OWNER TO "postgres";


CREATE TYPE "public"."waitlist_status" AS ENUM (
    'active',
    'inactive',
    'fulfilled',
    'cancelled'
);


ALTER TYPE "public"."waitlist_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."calculate_debt_paid_amount"("debt_id_param" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.payments
  WHERE debt_id = debt_id_param
    AND status IN ('paid', 'partial');
$$;


ALTER FUNCTION "public"."calculate_debt_paid_amount"("debt_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_debt_remaining_amount"("debt_id_param" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    d.original_amount - COALESCE(calculate_debt_paid_amount(debt_id_param), 0)
  FROM public.debts d
  WHERE d.id = debt_id_param;
$$;


ALTER FUNCTION "public"."calculate_debt_remaining_amount"("debt_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role::text = 'manager'
  );
$$;


ALTER FUNCTION "public"."is_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_debt_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  debt_record public.debts%ROWTYPE;
  paid_amount numeric(10,2);
  remaining_amount numeric(10,2);
  new_status public.debt_status;
  target_debt_id uuid;
BEGIN
  -- Get the debt_id from NEW (for INSERT/UPDATE) or OLD (for DELETE)
  target_debt_id := COALESCE(NEW.debt_id, OLD.debt_id);

  -- If no debt_id, skip processing
  IF target_debt_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the debt record
  SELECT * INTO debt_record
  FROM public.debts
  WHERE id = target_debt_id;

  IF debt_record.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate paid amount
  paid_amount := calculate_debt_paid_amount(debt_record.id);
  remaining_amount := calculate_debt_remaining_amount(debt_record.id);

  -- Determine new status
  IF remaining_amount <= 0 THEN
    new_status := 'paid';
  ELSIF paid_amount > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'open';
  END IF;

  -- Update debt status if it changed
  IF debt_record.status != new_status THEN
    UPDATE public.debts
    SET status = new_status,
        updated_at = now()
    WHERE id = debt_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_debt_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_sub_actions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_service_sub_actions_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "public"."appointment_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "grooming_appointment_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appointment_payments_check" CHECK (("grooming_appointment_id" IS NOT NULL))
);


ALTER TABLE "public"."appointment_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_reminder_sent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "appointment_type" "text" DEFAULT 'grooming'::"text" NOT NULL,
    "reminder_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flow_id" "text" NOT NULL,
    "manychat_subscriber_id" "text",
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "is_manual" boolean DEFAULT false NOT NULL,
    CONSTRAINT "appointment_reminder_sent_appointment_type_check" CHECK (("appointment_type" = 'grooming'::"text"))
);


ALTER TABLE "public"."appointment_reminder_sent" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointment_reminder_sent"."appointment_type" IS 'Type of appointment: grooming only';



COMMENT ON COLUMN "public"."appointment_reminder_sent"."is_manual" IS 'Whether the reminder that was sent was a manual reminder (can be sent on demand) or an automatic reminder.';



CREATE TABLE IF NOT EXISTS "public"."appointment_reminder_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "regular_days_reminder_days" integer,
    "regular_days_reminder_hours" integer,
    "regular_days_flow_id" "text",
    "sunday_reminder_days" integer,
    "sunday_reminder_hours" integer,
    "sunday_flow_id" "text",
    "message_template" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dog_ready_default_minutes" integer DEFAULT 30,
    CONSTRAINT "dog_ready_default_minutes_positive" CHECK ((("dog_ready_default_minutes" IS NULL) OR ("dog_ready_default_minutes" > 0)))
);


ALTER TABLE "public"."appointment_reminder_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_type" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "reminder_days" integer,
    "reminder_hours" integer,
    "flow_id" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "specific_time" time without time zone,
    "send_condition" "text",
    "is_manual" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    CONSTRAINT "appointment_reminders_day_type_check" CHECK (("day_type" = ANY (ARRAY['regular'::"text", 'sunday'::"text", 'manual'::"text"]))),
    CONSTRAINT "appointment_reminders_send_condition_check" CHECK ((("send_condition" IS NULL) OR ("send_condition" = ANY (ARRAY['send_only_if_not_approved'::"text", 'send_anyway'::"text"])))),
    CONSTRAINT "appointment_reminders_timing_check" CHECK ((("is_manual" = true) OR (("reminder_days" IS NOT NULL) OR ("reminder_hours" IS NOT NULL))))
);


ALTER TABLE "public"."appointment_reminders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointment_reminders"."specific_time" IS 'Specific time of day to send reminder (e.g., 18:00). If NULL, reminder is sent relative to appointment time based on reminder_days/reminder_hours.';



COMMENT ON COLUMN "public"."appointment_reminders"."send_condition" IS 'Condition for sending reminder: "send_only_if_not_approved" (only if appointment status is pending) or "send_anyway" (regardless of status). If NULL, defaults to "send_anyway" behavior.';



COMMENT ON COLUMN "public"."appointment_reminders"."is_manual" IS 'Whether this is a manual reminder (can be sent on demand) or an automatic reminder.';



COMMENT ON COLUMN "public"."appointment_reminders"."is_default" IS 'Whether this is the default manual reminder. Only one manual reminder can be marked as default.';



CREATE TABLE IF NOT EXISTS "public"."appointment_session_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grooming_appointment_id" "uuid",
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."appointment_session_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "station_id" "uuid",
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status" NOT NULL,
    "appointment_kind" "public"."appointment_kind" DEFAULT 'business'::"public"."appointment_kind" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "series_id" "text",
    "personal_reason" "text",
    "customer_notes" "text",
    "internal_notes" "text",
    "amount_due" numeric(10,2),
    "billing_url" "text",
    "billing_triggered_at" timestamp with time zone,
    "pickup_reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "appointment_name" "text",
    "client_confirmed_arrival" boolean DEFAULT false NOT NULL,
    "grooming_notes" "text",
    CONSTRAINT "appointments_check" CHECK (("end_at" > "start_at"))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "weekday" "text" NOT NULL,
    "shift_order" integer DEFAULT 0 NOT NULL,
    "open_time" time without time zone NOT NULL,
    "close_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_hours_check" CHECK (("close_time" > "open_time"))
);


ALTER TABLE "public"."business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "open_days_ahead" integer DEFAULT 30 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "grooming_appointment_id" "uuid",
    "appointment_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cart_appointments_check" CHECK (("grooming_appointment_id" IS NOT NULL))
);


ALTER TABLE "public"."cart_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "item_name" "text",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cart_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cart_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "cart_number" integer DEFAULT "nextval"('"public"."cart_number_seq"'::"regclass") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "provider" "text",
    "token" "text",
    "cvv" "text",
    "last4" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."credit_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_absence_reasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reason_text" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."custom_absence_reasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "contact_type" "text" DEFAULT 'phone'::"text",
    "contact_value" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."customer_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "priority" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "phone_search" "text",
    "address" "text",
    "customer_type_id" "uuid",
    "notes" "text",
    "classification" "public"."customer_class" DEFAULT 'new'::"public"."customer_class" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "staff_notes" "text",
    "lead_source_id" "uuid",
    "gender" "public"."customer_gender",
    "date_of_birth" "date",
    "external_id" "text",
    "city" "text",
    "is_banned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_notes" (
    "date" "date" NOT NULL,
    "notes" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "original_amount" numeric(10,2) NOT NULL,
    "description" "text",
    "due_date" timestamp with time zone,
    "status" "public"."debt_status" DEFAULT 'open'::"public"."debt_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "debts_original_amount_check" CHECK (("original_amount" > (0)::numeric))
);


ALTER TABLE "public"."debts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."edge_function_host_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."edge_function_host_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grooming_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "treatment_id" "text",
    "service_id" "uuid",
    "station_id" "uuid",
    "status" "public"."appointment_status" DEFAULT 'scheduled'::"public"."appointment_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status" NOT NULL,
    "appointment_kind" "public"."appointment_kind" DEFAULT 'business'::"public"."appointment_kind" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "series_id" "text",
    "personal_reason" "text",
    "customer_notes" "text",
    "internal_notes" "text",
    "amount_due" numeric(10,2),
    "billing_url" "text",
    "billing_triggered_at" timestamp with time zone,
    "pickup_reminder_sent_at" timestamp with time zone,
    "airtable_id" "text",
    "client_confirmed_arrival" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_approved_arrival" timestamp with time zone,
    "manager_approved_arrival" timestamp with time zone,
    "treatment_started_at" timestamp with time zone,
    "treatment_ended_at" timestamp with time zone,
    "worker_id" "uuid",
    CONSTRAINT "grooming_appointments_check" CHECK (("end_at" > "start_at"))
);


ALTER TABLE "public"."grooming_appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."grooming_appointments"."client_confirmed_arrival" IS 'Client confirmation that they will arrive for the appointment. Separate from manager approval (status field). Only clients can update this field.';



COMMENT ON COLUMN "public"."grooming_appointments"."client_approved_arrival" IS 'Timestamp when the client approved/confirmed their arrival. Set by client when they confirm they will arrive.';



COMMENT ON COLUMN "public"."grooming_appointments"."manager_approved_arrival" IS 'Timestamp when the manager approved the appointment arrival. Set by manager when they approve the appointment.';



COMMENT ON COLUMN "public"."grooming_appointments"."treatment_started_at" IS 'Timestamp when the treatment/grooming actually started. Set when staff begins working on the appointment.';



COMMENT ON COLUMN "public"."grooming_appointments"."treatment_ended_at" IS 'Timestamp when the treatment/grooming actually ended. Set when staff completes work on the appointment.';



CREATE TABLE IF NOT EXISTS "public"."lead_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_protected_screen_passwords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "password_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manager_protected_screen_passwords" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_protected_screens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "screen_id" "text" NOT NULL,
    "is_protected" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manager_protected_screens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_roles" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."manager_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2),
    "item_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "grooming_appointment_id" "uuid",
    "status" "text",
    "subtotal" numeric(10,2),
    "total" numeric(10,2),
    "cart_id" "uuid",
    "invoice_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."grooming_appointment_id" IS 'Reference to grooming appointment for this order';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" "text",
    "customer_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "order_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'ILS'::"text" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status" NOT NULL,
    "method" "text",
    "token_id" "uuid",
    "metadata" "jsonb",
    "note" "text",
    "transaction_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "debt_id" "uuid"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pinned_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reason" "public"."pin_reason" DEFAULT 'quick_access'::"public"."pin_reason" NOT NULL,
    "notes" "text",
    "target_date" "date",
    "pinned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_accessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_remove_after" timestamp with time zone,
    "appointment_type" "public"."service_category" DEFAULT 'grooming'::"public"."service_category" NOT NULL,
    CONSTRAINT "pinned_appointments_appointment_type_check" CHECK (("appointment_type" = 'grooming'::"public"."service_category"))
);


ALTER TABLE "public"."pinned_appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pinned_appointments"."appointment_type" IS 'Type of appointment being pinned. Currently only grooming is supported.';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "category" "text",
    "stock_quantity" integer,
    "cost_price" numeric(10,2),
    "bundle_price" numeric(10,2),
    "retail_price" numeric(10,2),
    "brand_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone_number" "text",
    "email" "text",
    "client_id" "uuid",
    "role" "text" DEFAULT 'client'::"text" NOT NULL,
    "worker_is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."role" IS 'User role: customer (לקוח), manager (מנהל), or worker (עובד)';



COMMENT ON COLUMN "public"."profiles"."worker_is_active" IS 'Whether the worker is currently active (only relevant when role = worker)';



CREATE TABLE IF NOT EXISTS "public"."proposed_meeting_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposed_meeting_id" "uuid" NOT NULL,
    "customer_type_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposed_meeting_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposed_meeting_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposed_meeting_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "source" "text",
    "source_category_id" "uuid",
    "last_notified_at" timestamp with time zone,
    "notification_count" integer DEFAULT 0 NOT NULL,
    "last_webhook_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposed_meeting_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposed_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "station_id" "uuid",
    "service_type" "text",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "code" "text",
    "title" "text",
    "summary" "text",
    "notes" "text",
    "reschedule_appointment_id" "uuid",
    "reschedule_customer_id" "uuid",
    "reschedule_original_start_at" timestamp with time zone,
    "reschedule_original_end_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."proposed_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "variant" "text" DEFAULT 'blue'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_station_matrix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "station_id" "uuid" NOT NULL,
    "base_time_minutes" integer DEFAULT 60 NOT NULL,
    "price_adjustment" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "remote_booking_allowed" boolean DEFAULT false NOT NULL,
    "requires_staff_approval" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."service_station_matrix" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_sub_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration" integer NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_sub_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "base_price" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "mode" "text" DEFAULT 'simple'::"text" NOT NULL,
    "duration" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "service_category_id" "uuid",
    CONSTRAINT "services_mode_check" CHECK (("mode" = ANY (ARRAY['simple'::"text", 'complicated'::"text"])))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_allowed_customer_types" (
    "shift_id" "uuid" NOT NULL,
    "customer_type_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shift_allowed_customer_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_blocked_customer_types" (
    "shift_id" "uuid" NOT NULL,
    "customer_type_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shift_blocked_customer_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."station_allowed_customer_types" (
    "station_id" "uuid" NOT NULL,
    "customer_type_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."station_allowed_customer_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."station_daily_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "weekday" "text" NOT NULL,
    "visible_station_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "station_order_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "show_waiting_list" boolean DEFAULT false NOT NULL,
    "show_pinned_appointments" boolean DEFAULT false NOT NULL,
    "special_items_order" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "station_daily_configs_weekday_check" CHECK (("weekday" = ANY (ARRAY['sunday'::"text", 'monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text"])))
);


ALTER TABLE "public"."station_daily_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."station_unavailability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "station_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "reason" "text",
    "notes" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."station_unavailability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."station_working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "station_id" "uuid" NOT NULL,
    "weekday" "text" NOT NULL,
    "shift_order" integer DEFAULT 0 NOT NULL,
    "open_time" time without time zone NOT NULL,
    "close_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "station_working_hours_check" CHECK (("close_time" > "open_time"))
);


ALTER TABLE "public"."station_working_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "break_between_treatments_minutes" integer DEFAULT 15 NOT NULL,
    "slot_interval_minutes" integer DEFAULT 15 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2),
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "total_entries" integer,
    "is_unlimited" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "public"."ticket_type_kind" DEFAULT 'entrances'::"public"."ticket_type_kind" NOT NULL,
    "days_duration" integer,
    "expiration_days" integer DEFAULT 365 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expiry_calculation_method" "public"."expiry_calculation_method" DEFAULT 'from_purchase_date'::"public"."expiry_calculation_method" NOT NULL,
    "visible_to_users" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."ticket_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "appointment_id" "uuid",
    "units_used" numeric(6,2) DEFAULT 1 NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid",
    "expires_on" "date",
    "total_entries" integer,
    "purchase_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "purchase_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatmentType_modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "treatment_type_id" "uuid" NOT NULL,
    "time_modifier_minutes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."treatmentType_modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatment_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."treatment_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatment_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "default_duration_minutes" integer DEFAULT 60 NOT NULL,
    "default_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "color_hex" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."treatment_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatmenttype_treatment_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "treatment_type_id" "uuid" NOT NULL,
    "treatment_category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."treatmenttype_treatment_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_attendance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_id" "uuid" NOT NULL,
    "clock_in" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clock_out" timestamp with time zone,
    "clock_in_note" "text",
    "clock_out_note" "text",
    "created_by" "uuid",
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_attendance_time_check" CHECK ((("clock_out" IS NULL) OR ("clock_out" >= "clock_in")))
);


ALTER TABLE "public"."worker_attendance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "supabase_migrations"."schema_migrations" (
    "version" "text" NOT NULL,
    "statements" "text"[],
    "name" "text"
);


ALTER TABLE "supabase_migrations"."schema_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "supabase_migrations"."seed_files" (
    "path" "text" NOT NULL,
    "hash" "text" NOT NULL
);


ALTER TABLE "supabase_migrations"."seed_files" OWNER TO "postgres";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_payments"
    ADD CONSTRAINT "appointment_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_reminder_sent"
    ADD CONSTRAINT "appointment_reminder_sent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_reminder_settings"
    ADD CONSTRAINT "appointment_reminder_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_reminders"
    ADD CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_session_images"
    ADD CONSTRAINT "appointment_session_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_weekday_shift_order_unique" UNIQUE ("weekday", "shift_order");



ALTER TABLE ONLY "public"."calendar_settings"
    ADD CONSTRAINT "calendar_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_appointments"
    ADD CONSTRAINT "cart_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_appointments"
    ADD CONSTRAINT "cart_appointments_unique" UNIQUE ("cart_id", "grooming_appointment_id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_cart_number_unique" UNIQUE ("cart_number");



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_tokens"
    ADD CONSTRAINT "credit_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_absence_reasons"
    ADD CONSTRAINT "custom_absence_reasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_absence_reasons"
    ADD CONSTRAINT "custom_absence_reasons_reason_text_key" UNIQUE ("reason_text");



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_types"
    ADD CONSTRAINT "customer_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."customer_types"
    ADD CONSTRAINT "customer_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_notes"
    ADD CONSTRAINT "daily_notes_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."edge_function_host_config"
    ADD CONSTRAINT "edge_function_host_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_airtable_id_key" UNIQUE ("airtable_id");



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_sources"
    ADD CONSTRAINT "lead_sources_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."lead_sources"
    ADD CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_protected_screen_passwords"
    ADD CONSTRAINT "manager_protected_screen_passwords_manager_id_key" UNIQUE ("manager_id");



ALTER TABLE ONLY "public"."manager_protected_screen_passwords"
    ADD CONSTRAINT "manager_protected_screen_passwords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_protected_screens"
    ADD CONSTRAINT "manager_protected_screens_manager_id_screen_id_key" UNIQUE ("manager_id", "screen_id");



ALTER TABLE ONLY "public"."manager_protected_screens"
    ADD CONSTRAINT "manager_protected_screens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_roles"
    ADD CONSTRAINT "manager_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pinned_appointments"
    ADD CONSTRAINT "pinned_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pinned_appointments"
    ADD CONSTRAINT "pinned_appointments_user_id_appointment_id_appointment_type_key" UNIQUE ("user_id", "appointment_id", "appointment_type");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposed_meeting_categories"
    ADD CONSTRAINT "proposed_meeting_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposed_meeting_invites"
    ADD CONSTRAINT "proposed_meeting_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposed_meetings"
    ADD CONSTRAINT "proposed_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_station_matrix"
    ADD CONSTRAINT "service_station_matrix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_station_matrix"
    ADD CONSTRAINT "service_station_matrix_service_id_station_id_key" UNIQUE ("service_id", "station_id");



ALTER TABLE ONLY "public"."service_sub_actions"
    ADD CONSTRAINT "service_sub_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_allowed_customer_types"
    ADD CONSTRAINT "shift_allowed_customer_types_pkey" PRIMARY KEY ("shift_id", "customer_type_id");



ALTER TABLE ONLY "public"."shift_blocked_customer_types"
    ADD CONSTRAINT "shift_blocked_customer_types_pkey" PRIMARY KEY ("shift_id", "customer_type_id");



ALTER TABLE ONLY "public"."station_allowed_customer_types"
    ADD CONSTRAINT "station_allowed_customer_types_pkey" PRIMARY KEY ("station_id", "customer_type_id");



ALTER TABLE ONLY "public"."station_daily_configs"
    ADD CONSTRAINT "station_daily_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."station_daily_configs"
    ADD CONSTRAINT "station_daily_configs_weekday_unique" UNIQUE ("weekday");



ALTER TABLE ONLY "public"."station_unavailability"
    ADD CONSTRAINT "station_unavailability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."station_working_hours"
    ADD CONSTRAINT "station_working_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."station_working_hours"
    ADD CONSTRAINT "station_working_hours_station_id_weekday_shift_order_key" UNIQUE ("station_id", "weekday", "shift_order");



ALTER TABLE ONLY "public"."stations"
    ADD CONSTRAINT "stations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."stations"
    ADD CONSTRAINT "stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_usages"
    ADD CONSTRAINT "ticket_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatmentType_modifiers"
    ADD CONSTRAINT "treatmentType_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatmentType_modifiers"
    ADD CONSTRAINT "treatmentType_modifiers_service_id_treatment_type_id_key" UNIQUE ("service_id", "treatment_type_id");



ALTER TABLE ONLY "public"."treatment_categories"
    ADD CONSTRAINT "treatment_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."treatment_categories"
    ADD CONSTRAINT "treatment_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_types"
    ADD CONSTRAINT "treatment_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."treatment_types"
    ADD CONSTRAINT "treatment_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatmenttype_treatment_categories"
    ADD CONSTRAINT "treatmenttype_treatment_categ_treatment_type_id_treatment_c_key" UNIQUE ("treatment_type_id", "treatment_category_id");



ALTER TABLE ONLY "public"."treatmenttype_treatment_categories"
    ADD CONSTRAINT "treatmenttype_treatment_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_attendance_logs"
    ADD CONSTRAINT "worker_attendance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "supabase_migrations"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "supabase_migrations"."seed_files"
    ADD CONSTRAINT "seed_files_pkey" PRIMARY KEY ("path");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "idx_appointment_reminder_sent_appointment" ON "public"."appointment_reminder_sent" USING "btree" ("appointment_id", "appointment_type");



CREATE INDEX "idx_appointments_customer" ON "public"."appointments" USING "btree" ("customer_id", "start_at");



CREATE INDEX "idx_appointments_station" ON "public"."appointments" USING "btree" ("station_id", "start_at") WHERE ("status" <> 'cancelled'::"public"."appointment_status");



CREATE INDEX "idx_business_hours_weekday_shift" ON "public"."business_hours" USING "btree" ("weekday", "shift_order");



CREATE INDEX "idx_cart_customer" ON "public"."carts" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_customer_contacts_customer_id" ON "public"."customer_contacts" USING "btree" ("customer_id");



CREATE INDEX "idx_customers_external_id" ON "public"."customers" USING "btree" ("external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_customers_is_banned" ON "public"."customers" USING "btree" ("is_banned") WHERE ("is_banned" = true);



CREATE INDEX "idx_customers_lead_source" ON "public"."customers" USING "btree" ("lead_source_id");



CREATE INDEX "idx_debts_customer" ON "public"."debts" USING "btree" ("customer_id");



CREATE INDEX "idx_debts_status" ON "public"."debts" USING "btree" ("status");



CREATE INDEX "idx_grooming_appointments_customer" ON "public"."grooming_appointments" USING "btree" ("customer_id", "start_at");



CREATE INDEX "idx_grooming_appointments_station" ON "public"."grooming_appointments" USING "btree" ("station_id", "start_at") WHERE ("status" <> 'cancelled'::"public"."appointment_status");



CREATE INDEX "idx_grooming_appointments_treatment_text" ON "public"."grooming_appointments" USING "btree" ("treatment_id") WHERE ("treatment_id" IS NOT NULL);



CREATE INDEX "idx_grooming_appointments_worker" ON "public"."grooming_appointments" USING "btree" ("worker_id") WHERE ("worker_id" IS NOT NULL);



CREATE INDEX "idx_manager_protected_screen_passwords_manager_id" ON "public"."manager_protected_screen_passwords" USING "btree" ("manager_id");



CREATE INDEX "idx_manager_protected_screens_manager_id" ON "public"."manager_protected_screens" USING "btree" ("manager_id");



CREATE INDEX "idx_manager_protected_screens_screen_id" ON "public"."manager_protected_screens" USING "btree" ("screen_id");



CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_orders_grooming_appointment" ON "public"."orders" USING "btree" ("grooming_appointment_id");



CREATE INDEX "idx_payments_appointment" ON "public"."payments" USING "btree" ("appointment_id");



CREATE INDEX "idx_payments_customer" ON "public"."payments" USING "btree" ("customer_id", "created_at" DESC);



CREATE INDEX "idx_payments_debt" ON "public"."payments" USING "btree" ("debt_id");



CREATE INDEX "idx_pinned_appointments_appointment" ON "public"."pinned_appointments" USING "btree" ("appointment_id", "appointment_type");



CREATE INDEX "idx_pinned_appointments_auto_remove" ON "public"."pinned_appointments" USING "btree" ("auto_remove_after") WHERE ("auto_remove_after" IS NOT NULL);



CREATE INDEX "idx_pinned_appointments_reason" ON "public"."pinned_appointments" USING "btree" ("user_id", "reason");



CREATE INDEX "idx_pinned_appointments_user" ON "public"."pinned_appointments" USING "btree" ("user_id", "pinned_at" DESC);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_role_worker_active" ON "public"."profiles" USING "btree" ("role", "worker_is_active") WHERE ("role" = 'worker'::"text");



CREATE INDEX "idx_profiles_worker_is_active" ON "public"."profiles" USING "btree" ("worker_is_active");



CREATE INDEX "idx_service_categories_name" ON "public"."service_categories" USING "btree" ("name");



CREATE UNIQUE INDEX "idx_service_categories_single_default" ON "public"."service_categories" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_service_sub_actions_order" ON "public"."service_sub_actions" USING "btree" ("service_id", "order_index");



CREATE INDEX "idx_service_sub_actions_service_id" ON "public"."service_sub_actions" USING "btree" ("service_id");



CREATE INDEX "idx_services_service_category_id" ON "public"."services" USING "btree" ("service_category_id");



CREATE INDEX "idx_station_unavailability_station" ON "public"."station_unavailability" USING "btree" ("station_id");



CREATE INDEX "idx_station_working_hours_station_weekday_shift" ON "public"."station_working_hours" USING "btree" ("station_id", "weekday", "shift_order");



CREATE INDEX "idx_ticket_usages_appointment" ON "public"."ticket_usages" USING "btree" ("appointment_id");



CREATE INDEX "idx_ticket_usages_ticket" ON "public"."ticket_usages" USING "btree" ("ticket_id", "used_at" DESC);



CREATE INDEX "idx_worker_attendance_worker" ON "public"."worker_attendance_logs" USING "btree" ("worker_id", "clock_in" DESC);



CREATE OR REPLACE TRIGGER "set_lead_sources_updated_at" BEFORE UPDATE ON "public"."lead_sources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_manager_protected_screen_passwords_updated_at" BEFORE UPDATE ON "public"."manager_protected_screen_passwords" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_manager_protected_screens_updated_at" BEFORE UPDATE ON "public"."manager_protected_screens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_service_categories_updated_at" BEFORE UPDATE ON "public"."service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_appointment_reminder_settings" BEFORE UPDATE ON "public"."appointment_reminder_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_appointment_reminders" BEFORE UPDATE ON "public"."appointment_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_appointment_session_images" BEFORE UPDATE ON "public"."appointment_session_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_appointments" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_business_hours" BEFORE UPDATE ON "public"."business_hours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_calendar_settings" BEFORE UPDATE ON "public"."calendar_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_cart_items" BEFORE UPDATE ON "public"."cart_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_carts" BEFORE UPDATE ON "public"."carts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_clients" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_credit_tokens" BEFORE UPDATE ON "public"."credit_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_custom_absence_reasons" BEFORE UPDATE ON "public"."custom_absence_reasons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_customer_contacts" BEFORE UPDATE ON "public"."customer_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_customer_types" BEFORE UPDATE ON "public"."customer_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_customers" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_daily_notes" BEFORE UPDATE ON "public"."daily_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_edge_function_host_config" BEFORE UPDATE ON "public"."edge_function_host_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_grooming_appointments" BEFORE UPDATE ON "public"."grooming_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_order_items" BEFORE UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_orders" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_payments" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_pinned_appointments" BEFORE UPDATE ON "public"."pinned_appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_products" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_proposed_meeting_categories" BEFORE UPDATE ON "public"."proposed_meeting_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_proposed_meeting_invites" BEFORE UPDATE ON "public"."proposed_meeting_invites" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_proposed_meetings" BEFORE UPDATE ON "public"."proposed_meetings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_service_station_matrix" BEFORE UPDATE ON "public"."service_station_matrix" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_service_sub_actions" BEFORE UPDATE ON "public"."service_sub_actions" FOR EACH ROW EXECUTE FUNCTION "public"."update_service_sub_actions_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_services" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_station_daily_configs" BEFORE UPDATE ON "public"."station_daily_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_station_unavailability" BEFORE UPDATE ON "public"."station_unavailability" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_station_working_hours" BEFORE UPDATE ON "public"."station_working_hours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_stations" BEFORE UPDATE ON "public"."stations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_ticket_types" BEFORE UPDATE ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_ticket_usages" BEFORE UPDATE ON "public"."ticket_usages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_tickets" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_treatment_categories" BEFORE UPDATE ON "public"."treatment_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_treatment_types" BEFORE UPDATE ON "public"."treatment_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_treatmenttype_modifiers" BEFORE UPDATE ON "public"."treatmentType_modifiers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_worker_attendance_logs" BEFORE UPDATE ON "public"."worker_attendance_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_debt_status_on_payment" AFTER INSERT OR DELETE OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_debt_status"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_payments"
    ADD CONSTRAINT "appointment_payments_grooming_appointment_id_fkey" FOREIGN KEY ("grooming_appointment_id") REFERENCES "public"."grooming_appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_payments"
    ADD CONSTRAINT "appointment_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_reminder_sent"
    ADD CONSTRAINT "appointment_reminder_sent_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_reminder_sent"
    ADD CONSTRAINT "appointment_reminder_sent_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "public"."appointment_reminders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_session_images"
    ADD CONSTRAINT "appointment_session_images_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointment_session_images"
    ADD CONSTRAINT "appointment_session_images_grooming_appointment_id_fkey" FOREIGN KEY ("grooming_appointment_id") REFERENCES "public"."grooming_appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_appointments"
    ADD CONSTRAINT "cart_appointments_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_appointments"
    ADD CONSTRAINT "cart_appointments_grooming_appointment_id_fkey" FOREIGN KEY ("grooming_appointment_id") REFERENCES "public"."grooming_appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_tokens"
    ADD CONSTRAINT "credit_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "public"."customer_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_notes"
    ADD CONSTRAINT "daily_notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."debts"
    ADD CONSTRAINT "debts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."grooming_appointments"
    ADD CONSTRAINT "grooming_appointments_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manager_protected_screen_passwords"
    ADD CONSTRAINT "manager_protected_screen_passwords_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_protected_screens"
    ADD CONSTRAINT "manager_protected_screens_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_roles"
    ADD CONSTRAINT "manager_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_grooming_appointment_id_fkey" FOREIGN KEY ("grooming_appointment_id") REFERENCES "public"."grooming_appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."credit_tokens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pinned_appointments"
    ADD CONSTRAINT "pinned_appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposed_meeting_categories"
    ADD CONSTRAINT "proposed_meeting_categories_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "public"."customer_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposed_meeting_categories"
    ADD CONSTRAINT "proposed_meeting_categories_proposed_meeting_id_fkey" FOREIGN KEY ("proposed_meeting_id") REFERENCES "public"."proposed_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposed_meeting_invites"
    ADD CONSTRAINT "proposed_meeting_invites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposed_meeting_invites"
    ADD CONSTRAINT "proposed_meeting_invites_proposed_meeting_id_fkey" FOREIGN KEY ("proposed_meeting_id") REFERENCES "public"."proposed_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposed_meetings"
    ADD CONSTRAINT "proposed_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposed_meetings"
    ADD CONSTRAINT "proposed_meetings_reschedule_appointment_id_fkey" FOREIGN KEY ("reschedule_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposed_meetings"
    ADD CONSTRAINT "proposed_meetings_reschedule_customer_id_fkey" FOREIGN KEY ("reschedule_customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposed_meetings"
    ADD CONSTRAINT "proposed_meetings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_station_matrix"
    ADD CONSTRAINT "service_station_matrix_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_station_matrix"
    ADD CONSTRAINT "service_station_matrix_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_sub_actions"
    ADD CONSTRAINT "service_sub_actions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_allowed_customer_types"
    ADD CONSTRAINT "shift_allowed_customer_types_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "public"."customer_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_allowed_customer_types"
    ADD CONSTRAINT "shift_allowed_customer_types_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."station_working_hours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_blocked_customer_types"
    ADD CONSTRAINT "shift_blocked_customer_types_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "public"."customer_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_blocked_customer_types"
    ADD CONSTRAINT "shift_blocked_customer_types_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."station_working_hours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."station_allowed_customer_types"
    ADD CONSTRAINT "station_allowed_customer_types_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "public"."customer_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."station_allowed_customer_types"
    ADD CONSTRAINT "station_allowed_customer_types_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."station_unavailability"
    ADD CONSTRAINT "station_unavailability_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."station_working_hours"
    ADD CONSTRAINT "station_working_hours_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_usages"
    ADD CONSTRAINT "ticket_usages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_usages"
    ADD CONSTRAINT "ticket_usages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."treatmentType_modifiers"
    ADD CONSTRAINT "treatmentType_modifiers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatmentType_modifiers"
    ADD CONSTRAINT "treatmentType_modifiers_treatment_type_id_fkey" FOREIGN KEY ("treatment_type_id") REFERENCES "public"."treatment_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatmenttype_treatment_categories"
    ADD CONSTRAINT "treatmenttype_treatment_categories_treatment_category_id_fkey" FOREIGN KEY ("treatment_category_id") REFERENCES "public"."treatment_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."treatmenttype_treatment_categories"
    ADD CONSTRAINT "treatmenttype_treatment_categories_treatment_type_id_fkey" FOREIGN KEY ("treatment_type_id") REFERENCES "public"."treatment_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_attendance_logs"
    ADD CONSTRAINT "worker_attendance_logs_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_attendance_logs"
    ADD CONSTRAINT "worker_attendance_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_attendance_logs"
    ADD CONSTRAINT "worker_attendance_logs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow all operations on appointments" ON "public"."appointments" USING (true);



CREATE POLICY "Allow all operations on business_hours" ON "public"."business_hours" USING (true);



CREATE POLICY "Allow all operations on calendar_settings" ON "public"."calendar_settings" USING (true);



CREATE POLICY "Allow all operations on clients" ON "public"."clients" USING (true);



CREATE POLICY "Allow all operations on custom_absence_reasons" ON "public"."custom_absence_reasons" USING (true);



CREATE POLICY "Allow all operations on customer_types" ON "public"."customer_types" USING (true);



CREATE POLICY "Allow all operations on customers" ON "public"."customers" USING (true);



CREATE POLICY "Allow all operations on daily_notes" ON "public"."daily_notes" USING (true);



CREATE POLICY "Allow all operations on grooming_appointments" ON "public"."grooming_appointments" USING (true);



CREATE POLICY "Allow all operations on proposed_meeting_categories" ON "public"."proposed_meeting_categories" USING (true);



CREATE POLICY "Allow all operations on proposed_meeting_invites" ON "public"."proposed_meeting_invites" USING (true);



CREATE POLICY "Allow all operations on proposed_meetings" ON "public"."proposed_meetings" USING (true);



CREATE POLICY "Allow all operations on service_station_matrix" ON "public"."service_station_matrix" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on service_sub_actions" ON "public"."service_sub_actions" USING (true);



CREATE POLICY "Allow all operations on services" ON "public"."services" USING (true);



CREATE POLICY "Allow all operations on shift_allowed_customer_types" ON "public"."shift_allowed_customer_types" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on shift_blocked_customer_types" ON "public"."shift_blocked_customer_types" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on station_allowed_customer_types" ON "public"."station_allowed_customer_types" USING (true);



CREATE POLICY "Allow all operations on station_unavailability" ON "public"."station_unavailability" USING (true);



CREATE POLICY "Allow all operations on station_working_hours" ON "public"."station_working_hours" USING (true);



CREATE POLICY "Allow all operations on stations" ON "public"."stations" USING (true);



CREATE POLICY "Allow all operations on ticket_types" ON "public"."ticket_types" USING (true);



CREATE POLICY "Allow all operations on treatmentType_modifiers" ON "public"."treatmentType_modifiers" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all operations on treatmentType_treatment_categories" ON "public"."treatmenttype_treatment_categories" USING (true);



CREATE POLICY "Allow all operations on treatment_categories" ON "public"."treatment_categories" USING (true);



CREATE POLICY "Allow all operations on treatment_types" ON "public"."treatment_types" USING (true);



CREATE POLICY "Managers can manage their own protected screens" ON "public"."manager_protected_screens" USING (("auth"."uid"() = "manager_id"));



CREATE POLICY "Managers can update their own protected screen password" ON "public"."manager_protected_screen_passwords" USING (("auth"."uid"() = "manager_id"));



CREATE POLICY "Managers can update worker profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "id") OR ("public"."is_manager"() AND ("role" = 'worker'::"text")))) WITH CHECK ((("auth"."uid"() = "id") OR ("public"."is_manager"() AND ("role" = 'worker'::"text"))));



CREATE POLICY "Managers can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR "public"."is_manager"()));



CREATE POLICY "Managers can view their own protected screen password" ON "public"."manager_protected_screen_passwords" FOR SELECT USING (("auth"."uid"() = "manager_id"));



CREATE POLICY "Managers can view their own protected screens" ON "public"."manager_protected_screens" FOR SELECT USING (("auth"."uid"() = "manager_id"));



CREATE POLICY "Users can delete debts" ON "public"."debts" FOR DELETE USING (true);



CREATE POLICY "Users can insert debts" ON "public"."debts" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update debts" ON "public"."debts" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can view debts" ON "public"."debts" FOR SELECT USING (true);



CREATE POLICY "Users manage their own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."appointment_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_payments_allow_all" ON "public"."appointment_payments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appointment_reminder_sent" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_reminder_sent_allow_all" ON "public"."appointment_reminder_sent" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appointment_reminder_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_reminder_settings_allow_all" ON "public"."appointment_reminder_settings" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appointment_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_reminders_allow_all" ON "public"."appointment_reminders" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appointment_session_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_session_images_allow_all" ON "public"."appointment_session_images" USING (true) WITH CHECK (true);



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_allow_all" ON "public"."brands" USING (true) WITH CHECK (true);



ALTER TABLE "public"."business_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_appointments_allow_all" ON "public"."cart_appointments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cart_items_allow_all" ON "public"."cart_items" USING (true) WITH CHECK (true);



ALTER TABLE "public"."carts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carts_allow_all" ON "public"."carts" USING (true) WITH CHECK (true);



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_tokens_allow_all" ON "public"."credit_tokens" USING (true) WITH CHECK (true);



ALTER TABLE "public"."custom_absence_reasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_contacts_allow_all" ON "public"."customer_contacts" USING (true) WITH CHECK (true);



ALTER TABLE "public"."customer_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."edge_function_host_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "edge_function_host_config_allow_all" ON "public"."edge_function_host_config" USING (true) WITH CHECK (true);



ALTER TABLE "public"."grooming_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manager_protected_screen_passwords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manager_protected_screens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manager_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_roles_allow_all" ON "public"."manager_roles" USING (true) WITH CHECK (true);



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_allow_all" ON "public"."order_items" USING (true) WITH CHECK (true);



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_allow_all" ON "public"."orders" USING (true) WITH CHECK (true);



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_allow_all" ON "public"."payments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."pinned_appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pinned_appointments_allow_all" ON "public"."pinned_appointments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_allow_all" ON "public"."products" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposed_meeting_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposed_meeting_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proposed_meetings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_station_matrix" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_sub_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_allowed_customer_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_blocked_customer_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."station_allowed_customer_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."station_daily_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "station_daily_configs_allow_all" ON "public"."station_daily_configs" USING (true) WITH CHECK (true);



ALTER TABLE "public"."station_unavailability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."station_working_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_usages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_usages_allow_all" ON "public"."ticket_usages" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets_allow_all" ON "public"."tickets" USING (true) WITH CHECK (true);



ALTER TABLE "public"."treatmentType_modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatment_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatment_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatmenttype_treatment_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_attendance_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "worker_attendance_logs_allow_all" ON "public"."worker_attendance_logs" USING (true) WITH CHECK (true);



GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."calculate_debt_paid_amount"("debt_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_debt_paid_amount"("debt_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_debt_paid_amount"("debt_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_debt_remaining_amount"("debt_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_debt_remaining_amount"("debt_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_debt_remaining_amount"("debt_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_debt_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_debt_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_debt_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_service_sub_actions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_sub_actions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_service_sub_actions_updated_at"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "public"."appointment_payments" TO "anon";
GRANT ALL ON TABLE "public"."appointment_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_payments" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_reminder_sent" TO "anon";
GRANT ALL ON TABLE "public"."appointment_reminder_sent" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_reminder_sent" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_reminder_settings" TO "anon";
GRANT ALL ON TABLE "public"."appointment_reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_reminder_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_reminders" TO "anon";
GRANT ALL ON TABLE "public"."appointment_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_session_images" TO "anon";
GRANT ALL ON TABLE "public"."appointment_session_images" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_session_images" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."business_hours" TO "anon";
GRANT ALL ON TABLE "public"."business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_settings" TO "anon";
GRANT ALL ON TABLE "public"."calendar_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_settings" TO "service_role";



GRANT ALL ON TABLE "public"."cart_appointments" TO "anon";
GRANT ALL ON TABLE "public"."cart_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cart_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cart_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cart_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."carts" TO "anon";
GRANT ALL ON TABLE "public"."carts" TO "authenticated";
GRANT ALL ON TABLE "public"."carts" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."credit_tokens" TO "anon";
GRANT ALL ON TABLE "public"."credit_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."custom_absence_reasons" TO "anon";
GRANT ALL ON TABLE "public"."custom_absence_reasons" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_absence_reasons" TO "service_role";



GRANT ALL ON TABLE "public"."customer_contacts" TO "anon";
GRANT ALL ON TABLE "public"."customer_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."customer_types" TO "anon";
GRANT ALL ON TABLE "public"."customer_types" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_types" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."daily_notes" TO "anon";
GRANT ALL ON TABLE "public"."daily_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_notes" TO "service_role";



GRANT ALL ON TABLE "public"."debts" TO "anon";
GRANT ALL ON TABLE "public"."debts" TO "authenticated";
GRANT ALL ON TABLE "public"."debts" TO "service_role";



GRANT ALL ON TABLE "public"."edge_function_host_config" TO "anon";
GRANT ALL ON TABLE "public"."edge_function_host_config" TO "authenticated";
GRANT ALL ON TABLE "public"."edge_function_host_config" TO "service_role";



GRANT ALL ON TABLE "public"."grooming_appointments" TO "anon";
GRANT ALL ON TABLE "public"."grooming_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."grooming_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."lead_sources" TO "anon";
GRANT ALL ON TABLE "public"."lead_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_sources" TO "service_role";



GRANT ALL ON TABLE "public"."manager_protected_screen_passwords" TO "anon";
GRANT ALL ON TABLE "public"."manager_protected_screen_passwords" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_protected_screen_passwords" TO "service_role";



GRANT ALL ON TABLE "public"."manager_protected_screens" TO "anon";
GRANT ALL ON TABLE "public"."manager_protected_screens" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_protected_screens" TO "service_role";



GRANT ALL ON TABLE "public"."manager_roles" TO "anon";
GRANT ALL ON TABLE "public"."manager_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_roles" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pinned_appointments" TO "anon";
GRANT ALL ON TABLE "public"."pinned_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."pinned_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."proposed_meeting_categories" TO "anon";
GRANT ALL ON TABLE "public"."proposed_meeting_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."proposed_meeting_categories" TO "service_role";



GRANT ALL ON TABLE "public"."proposed_meeting_invites" TO "anon";
GRANT ALL ON TABLE "public"."proposed_meeting_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."proposed_meeting_invites" TO "service_role";



GRANT ALL ON TABLE "public"."proposed_meetings" TO "anon";
GRANT ALL ON TABLE "public"."proposed_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."proposed_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_station_matrix" TO "anon";
GRANT ALL ON TABLE "public"."service_station_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."service_station_matrix" TO "service_role";



GRANT ALL ON TABLE "public"."service_sub_actions" TO "anon";
GRANT ALL ON TABLE "public"."service_sub_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."service_sub_actions" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shift_allowed_customer_types" TO "anon";
GRANT ALL ON TABLE "public"."shift_allowed_customer_types" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_allowed_customer_types" TO "service_role";



GRANT ALL ON TABLE "public"."shift_blocked_customer_types" TO "anon";
GRANT ALL ON TABLE "public"."shift_blocked_customer_types" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_blocked_customer_types" TO "service_role";



GRANT ALL ON TABLE "public"."station_allowed_customer_types" TO "anon";
GRANT ALL ON TABLE "public"."station_allowed_customer_types" TO "authenticated";
GRANT ALL ON TABLE "public"."station_allowed_customer_types" TO "service_role";



GRANT ALL ON TABLE "public"."station_daily_configs" TO "anon";
GRANT ALL ON TABLE "public"."station_daily_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."station_daily_configs" TO "service_role";



GRANT ALL ON TABLE "public"."station_unavailability" TO "anon";
GRANT ALL ON TABLE "public"."station_unavailability" TO "authenticated";
GRANT ALL ON TABLE "public"."station_unavailability" TO "service_role";



GRANT ALL ON TABLE "public"."station_working_hours" TO "anon";
GRANT ALL ON TABLE "public"."station_working_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."station_working_hours" TO "service_role";



GRANT ALL ON TABLE "public"."stations" TO "anon";
GRANT ALL ON TABLE "public"."stations" TO "authenticated";
GRANT ALL ON TABLE "public"."stations" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_types" TO "anon";
GRANT ALL ON TABLE "public"."ticket_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_types" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_usages" TO "anon";
GRANT ALL ON TABLE "public"."ticket_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_usages" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."treatmentType_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."treatmentType_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."treatmentType_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_categories" TO "anon";
GRANT ALL ON TABLE "public"."treatment_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_categories" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_types" TO "anon";
GRANT ALL ON TABLE "public"."treatment_types" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_types" TO "service_role";



GRANT ALL ON TABLE "public"."treatmenttype_treatment_categories" TO "anon";
GRANT ALL ON TABLE "public"."treatmenttype_treatment_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."treatmenttype_treatment_categories" TO "service_role";



GRANT ALL ON TABLE "public"."worker_attendance_logs" TO "anon";
GRANT ALL ON TABLE "public"."worker_attendance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_attendance_logs" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







