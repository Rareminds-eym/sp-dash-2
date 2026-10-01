import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Could not find the requested resource.</p>
      <Link href="/" className="text-indigo-600 hover:underline font-medium">
        Return Home
      </Link>
    </div>
  );
}
