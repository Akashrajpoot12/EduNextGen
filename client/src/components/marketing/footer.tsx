import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="py-6 md:px-8 md:py-0 border-t bg-muted/20">
      <div className="container mx-auto px-4 flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built for modern schools. Powered by Next.js & Supabase.
        </p>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <Link to="#" className="hover:underline">Terms</Link>
          <Link to="#" className="hover:underline">Privacy</Link>
          <Link to="#" className="hover:underline">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

