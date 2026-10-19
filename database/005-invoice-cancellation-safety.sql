-- Once a provider confirms cancellation, stale viewed/sent/paid writers must not
-- reopen that invoice and make its portal link payable again.
CREATE OR REPLACE FUNCTION public.protect_cancelled_invoice()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be reopened; create a replacement invoice.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_cancelled_invoice ON public.invoices;
CREATE TRIGGER protect_cancelled_invoice BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_cancelled_invoice();
