ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_national boolean NOT NULL DEFAULT false;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS is_national boolean NOT NULL DEFAULT false;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS appointed_on date;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS contract_until date;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS trophies integer NOT NULL DEFAULT 0;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS preferred_formation text;
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS bio text;

CREATE TABLE IF NOT EXISTS public.national_team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  shirt_number integer,
  photo_url text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, player_id)
);
GRANT SELECT ON public.national_team_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.national_team_players TO authenticated;
GRANT ALL ON public.national_team_players TO service_role;
ALTER TABLE public.national_team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read national call-ups" ON public.national_team_players FOR SELECT USING (true);
CREATE POLICY "admin write national call-ups" ON public.national_team_players FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS national_team_players_player_idx ON public.national_team_players(player_id);

INSERT INTO public.teams (name, country, country_code, logo_url, is_national)
SELECT split_part(v, '|', 2), split_part(v, '|', 2), split_part(v, '|', 1),
       'https://flagcdn.com/w160/' || lower(split_part(v, '|', 1)) || '.png', true
FROM unnest(string_to_array('AF|Afghanistan,AU|Australia,BH|Bahrain,BD|Bangladesh,BT|Bhutan,BN|Brunei,KH|Cambodia,CN|China,TW|Chinese Taipei,GU|Guam,HK|Hong Kong,IN|India,ID|Indonesia,IR|Iran,IQ|Iraq,JP|Japan,JO|Jordan,KW|Kuwait,KG|Kyrgyzstan,LA|Laos,LB|Lebanon,MO|Macau,MY|Malaysia,MV|Maldives,MN|Mongolia,MM|Myanmar,NP|Nepal,KP|North Korea,OM|Oman,PK|Pakistan,PS|Palestine,PH|Philippines,QA|Qatar,SA|Saudi Arabia,SG|Singapore,KR|South Korea,LK|Sri Lanka,SY|Syria,TJ|Tajikistan,TH|Thailand,TL|Timor-Leste,TM|Turkmenistan,AE|United Arab Emirates,UZ|Uzbekistan,VN|Vietnam,YE|Yemen,DZ|Algeria,AO|Angola,BJ|Benin,BW|Botswana,BF|Burkina Faso,BI|Burundi,CM|Cameroon,CV|Cape Verde,CF|Central African Republic,TD|Chad,KM|Comoros,CG|Congo,CD|DR Congo,DJ|Djibouti,EG|Egypt,GQ|Equatorial Guinea,ER|Eritrea,SZ|Eswatini,ET|Ethiopia,GA|Gabon,GM|Gambia,GH|Ghana,GN|Guinea,GW|Guinea-Bissau,CI|Ivory Coast,KE|Kenya,LS|Lesotho,LR|Liberia,LY|Libya,MG|Madagascar,MW|Malawi,ML|Mali,MR|Mauritania,MU|Mauritius,MA|Morocco,MZ|Mozambique,NA|Namibia,NE|Niger,NG|Nigeria,RW|Rwanda,ST|Sao Tome and Principe,SN|Senegal,SC|Seychelles,SL|Sierra Leone,SO|Somalia,ZA|South Africa,SS|South Sudan,SD|Sudan,TZ|Tanzania,TG|Togo,TN|Tunisia,UG|Uganda,ZM|Zambia,ZW|Zimbabwe,AI|Anguilla,AG|Antigua and Barbuda,AW|Aruba,BS|Bahamas,BB|Barbados,BZ|Belize,BM|Bermuda,VG|British Virgin Islands,CA|Canada,KY|Cayman Islands,CR|Costa Rica,CU|Cuba,CW|Curacao,DM|Dominica,DO|Dominican Republic,SV|El Salvador,GD|Grenada,GT|Guatemala,GY|Guyana,HT|Haiti,HN|Honduras,JM|Jamaica,MX|Mexico,MS|Montserrat,NI|Nicaragua,PA|Panama,PR|Puerto Rico,KN|St Kitts and Nevis,LC|St Lucia,VC|St Vincent and the Grenadines,SR|Suriname,TT|Trinidad and Tobago,TC|Turks and Caicos Islands,US|United States,VI|US Virgin Islands,SX|Sint Maarten,AR|Argentina,BO|Bolivia,BR|Brazil,CL|Chile,CO|Colombia,EC|Ecuador,PY|Paraguay,PE|Peru,UY|Uruguay,VE|Venezuela,AS|American Samoa,CK|Cook Islands,FJ|Fiji,NC|New Caledonia,NZ|New Zealand,PG|Papua New Guinea,WS|Samoa,SB|Solomon Islands,TO|Tonga,VU|Vanuatu,AL|Albania,AD|Andorra,AM|Armenia,AT|Austria,AZ|Azerbaijan,BY|Belarus,BE|Belgium,BA|Bosnia and Herzegovina,BG|Bulgaria,HR|Croatia,CY|Cyprus,CZ|Czechia,DK|Denmark,GB-ENG|England,EE|Estonia,FO|Faroe Islands,FI|Finland,FR|France,GE|Georgia,DE|Germany,GI|Gibraltar,GR|Greece,HU|Hungary,IS|Iceland,IL|Israel,IT|Italy,KZ|Kazakhstan,XK|Kosovo,LV|Latvia,LI|Liechtenstein,LT|Lithuania,LU|Luxembourg,MT|Malta,MD|Moldova,ME|Montenegro,NL|Netherlands,MK|North Macedonia,GB-NIR|Northern Ireland,NO|Norway,PL|Poland,PT|Portugal,IE|Ireland,RO|Romania,RU|Russia,SM|San Marino,GB-SCT|Scotland,RS|Serbia,SK|Slovakia,SI|Slovenia,ES|Spain,SE|Sweden,CH|Switzerland,TR|Turkiye,UA|Ukraine,GB-WLS|Wales', ',')) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.is_national AND t.country_code = split_part(v, '|', 1));