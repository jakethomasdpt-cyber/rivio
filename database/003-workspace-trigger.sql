-- Create each new user's workspace in the same transaction as the user.
CREATE FUNCTION public.create_auth_user_workspace() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.workspaces (user_id, business_name, email, owner_name)
  VALUES (NEW.id, COALESCE(NEW."businessName", 'My Business'), NEW.email, NEW.name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER auth_user_workspace AFTER INSERT ON public.auth_user
FOR EACH ROW EXECUTE FUNCTION public.create_auth_user_workspace();
REVOKE ALL ON FUNCTION public.create_auth_user_workspace() FROM PUBLIC;
