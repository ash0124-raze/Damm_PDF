import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm py-4 px-8 flex justify-between items-center">
      <Link href="/" className="text-2xl font-black text-blue-600 tracking-tight">
        Damm<span className="text-gray-800">PDF</span>
      </Link>
      <div className="flex gap-6 text-sm font-semibold text-gray-600">
        <Link href="/compress" className="hover:text-blue-600 transition-colors">Compress</Link>
        <Link href="/merge" className="hover:text-blue-600 transition-colors">Merge</Link>
        <Link href="/split" className="hover:text-blue-600 transition-colors">Split</Link>
        <Link href="/images-to-pdf" className="hover:text-blue-600 transition-colors">Images to PDF</Link>
        <Link href="/rotate" className="hover:text-blue-600 transition-colors">Rotate</Link>
        <Link href="/pdf-to-images" className="hover:text-blue-600 transition-colors">PDF to Images</Link>
        <Link href="/encrypt" className="hover:text-blue-600 transition-colors">Protect</Link>
      </div>
    </nav>
  );
}