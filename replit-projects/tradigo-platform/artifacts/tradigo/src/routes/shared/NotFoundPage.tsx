import { Link } from 'react-router';
export const NotFoundPage = () => <div className="p-8 text-center"><h1 className="text-2xl font-bold">404 Not Found</h1><p>Page does not exist.</p><Link to="/" className="text-primary hover:underline mt-4 inline-block">Go Home</Link></div>;
