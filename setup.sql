CREATE TABLE public.alert_events (
    id integer NOT NULL,
    alert_id integer,
    coin_id text NOT NULL,
    message text NOT NULL,
    value double precision,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.alert_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.alert_events_id_seq OWNED BY public.alert_events.id;
CREATE TABLE public.alerts (
    id integer NOT NULL,
    coin_id text NOT NULL,
    symbol text NOT NULL,
    type text NOT NULL,
    operator text NOT NULL,
    threshold double precision NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;
CREATE TABLE public.api_cache (
    key text NOT NULL,
    source text NOT NULL,
    body jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.catalysts (
    id integer NOT NULL,
    coin_id text NOT NULL,
    event_date date,
    kind text NOT NULL,
    event text NOT NULL,
    significance text,
    risk text,
    unlock_pct_of_supply double precision,
    resolved boolean DEFAULT false NOT NULL,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.catalysts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.catalysts_id_seq OWNED BY public.catalysts.id;
CREATE TABLE public.holdings (
    id integer NOT NULL,
    coin_id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    image text,
    quantity double precision NOT NULL,
    avg_entry_usd double precision NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.holdings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.holdings_id_seq OWNED BY public.holdings.id;
CREATE TABLE public.price_snapshots (
    id integer NOT NULL,
    snap_date date NOT NULL,
    coin_id text NOT NULL,
    price_usd double precision,
    market_cap double precision,
    volume_24h double precision
);
CREATE SEQUENCE public.price_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.price_snapshots_id_seq OWNED BY public.price_snapshots.id;
CREATE TABLE public.saved_screens (
    id integer NOT NULL,
    name text NOT NULL,
    filters jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.saved_screens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.saved_screens_id_seq OWNED BY public.saved_screens.id;
CREATE TABLE public.scan_coins (
    id integer NOT NULL,
    scan_id integer NOT NULL,
    coin_id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    image text,
    selected boolean DEFAULT false NOT NULL,
    rank integer,
    price_usd double precision,
    market_cap double precision,
    fdv double precision,
    volume_24h double precision,
    change_7d double precision,
    change_30d double precision,
    change_90d double precision,
    score integer NOT NULL,
    risk_level text NOT NULL,
    excluded boolean DEFAULT false NOT NULL,
    reason text,
    analysis jsonb NOT NULL
);
CREATE SEQUENCE public.scan_coins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.scan_coins_id_seq OWNED BY public.scan_coins.id;
CREATE TABLE public.scans (
    id integer NOT NULL,
    scan_date date NOT NULL,
    trigger text NOT NULL,
    status text NOT NULL,
    progress text,
    data_mode text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    market jsonb,
    universe_count integer DEFAULT 0 NOT NULL,
    eligible_count integer DEFAULT 0 NOT NULL,
    analyzed_count integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL
);
CREATE SEQUENCE public.scans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.scans_id_seq OWNED BY public.scans.id;
CREATE TABLE public.settings (
    id text DEFAULT 'default'::text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.universe (
    coin_id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    image text,
    rank integer,
    price_usd double precision,
    market_cap double precision,
    fdv double precision,
    volume_24h double precision,
    change_24h double precision,
    change_7d double precision,
    change_30d double precision,
    change_200d double precision,
    circulating double precision,
    total_supply double precision,
    max_supply double precision,
    ath_change_pct double precision,
    tvl double precision,
    sector text,
    chain text,
    excluded_type text,
    scan_id integer,
    source_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.watchlist (
    coin_id text NOT NULL,
    symbol text NOT NULL,
    name text NOT NULL,
    image text,
    note text,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.alert_events ALTER COLUMN id SET DEFAULT nextval('public.alert_events_id_seq'::regclass);
ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);
ALTER TABLE ONLY public.catalysts ALTER COLUMN id SET DEFAULT nextval('public.catalysts_id_seq'::regclass);
ALTER TABLE ONLY public.holdings ALTER COLUMN id SET DEFAULT nextval('public.holdings_id_seq'::regclass);
ALTER TABLE ONLY public.price_snapshots ALTER COLUMN id SET DEFAULT nextval('public.price_snapshots_id_seq'::regclass);
ALTER TABLE ONLY public.saved_screens ALTER COLUMN id SET DEFAULT nextval('public.saved_screens_id_seq'::regclass);
ALTER TABLE ONLY public.scan_coins ALTER COLUMN id SET DEFAULT nextval('public.scan_coins_id_seq'::regclass);
ALTER TABLE ONLY public.scans ALTER COLUMN id SET DEFAULT nextval('public.scans_id_seq'::regclass);
ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.api_cache
    ADD CONSTRAINT api_cache_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.catalysts
    ADD CONSTRAINT catalysts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.saved_screens
    ADD CONSTRAINT saved_screens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scan_coins
    ADD CONSTRAINT scan_coins_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.scans
    ADD CONSTRAINT scans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.universe
    ADD CONSTRAINT universe_pkey PRIMARY KEY (coin_id);
ALTER TABLE ONLY public.watchlist
    ADD CONSTRAINT watchlist_pkey PRIMARY KEY (coin_id);
CREATE INDEX scan_coins_coin_idx ON public.scan_coins USING btree (coin_id);
CREATE INDEX scan_coins_scan_idx ON public.scan_coins USING btree (scan_id);
CREATE INDEX scans_date_idx ON public.scans USING btree (scan_date);
CREATE INDEX snap_coin_idx ON public.price_snapshots USING btree (coin_id, snap_date);
CREATE UNIQUE INDEX snap_unique ON public.price_snapshots USING btree (snap_date, coin_id);
ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_alert_id_alerts_id_fk FOREIGN KEY (alert_id) REFERENCES public.alerts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scan_coins
    ADD CONSTRAINT scan_coins_scan_id_scans_id_fk FOREIGN KEY (scan_id) REFERENCES public.scans(id) ON DELETE CASCADE;
