import { Link } from "wouter";
import { Activity } from "lucide-react";
import { FaTwitter, FaDiscord, FaTelegram, FaGithub } from "react-icons/fa";

const footerSections = [
  {
    title: "Marketplace",
    links: [
      { name: "Browse Items", href: "/" },
      { name: "Create Listing", href: "/create" },
      { name: "Collections", href: "#" },
      { name: "Trending", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Help Center", href: "#" },
      { name: "Getting Started", href: "#" },
      { name: "Contact Us", href: "#" },
      { name: "Bug Reports", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Documentation", href: "#" },
      { name: "API Reference", href: "#" },
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
    ],
  },
];

const socialLinks = [
  { name: "Twitter", icon: FaTwitter, href: "#" },
  { name: "Discord", icon: FaDiscord, href: "#" },
  { name: "Telegram", icon: FaTelegram, href: "#" },
  { name: "GitHub", icon: FaGithub, href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-dark-800 border-t border-gray-800 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Activity className="text-white w-4 h-4" />
              </div>
              <span className="text-lg font-bold">streamRoll</span>
            </Link>
            <p className="text-gray-400 mb-4">
              The future of digital commerce, powered by Web3 technology and decentralized marketplaces.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="text-gray-400 hover:text-primary transition-colors"
                  aria-label={social.name}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Footer Sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2 text-gray-400">
                {section.links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className="hover:text-primary transition-colors">
                        {link.name}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-primary transition-colors">
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; 2024 streamRoll. All rights reserved. Built with ❤️ for the decentralized future.</p>
        </div>
      </div>
    </footer>
  );
}
