import { ExternalLink } from "lucide-react";

/** FCA reference number shown across the site. */
export const FCA_FRN = "600410";

/** Public FCA Register entry for EdgeWealth Pro Holdings. */
export const FCA_REGISTER_URL =
  "https://register.fca.org.uk/s/firm?id=001b000000NMPvaAAH";

export const FcaRegisterLink = ({
  label = "Verify license on the FCA Register",
  className = "inline-flex items-center gap-1 text-primary hover:underline",
  iconClassName = "h-3 w-3",
}: {
  label?: string;
  className?: string;
  iconClassName?: string;
}) => (
  <a
    href={FCA_REGISTER_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={className}
  >
    {label}
    <ExternalLink className={iconClassName} />
  </a>
);
