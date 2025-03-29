import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Search, ArrowUpRight, Activity, Users, Globe, Mail, Archive, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, checkConnection, analyzeDomain } from './lib/supabase';
import type { Domain } from './types/supabase';
import type { AnalysisProgress } from './types/analyzer';

function App() {
  const [search, setSearch] = useState('');
  const [minTraffic, setMinTraffic] = useState(0);
  const [sortBy, setSortBy] = useState<'traffic_score' | 'estimated_traffic' | 'indexed_pages'>('traffic_score');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<Record<string, AnalysisProgress>>({});
  const queryClient = useQueryClient();

  React.useEffect(() => {
    checkConnection().then(isConnected => {
      setConnectionError(!isConnected);
    });
  }, []);

  const domainsQuery = useQuery<Domain[]>(
    ['domains', search, minTraffic, sortBy],
    async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('domains')
          .select('*')
          .limit(50);

        if (!search) {
          query = query.eq('status', 'available');
        }

        if (search) {
          if (search.length >= 3) {
            query = query.ilike('domain', `%${search}%`);
          } else {
            query = query.eq('domain', search);
          }
        }

        if (minTraffic > 0) {
          query = query.gte('estimated_traffic', minTraffic);
        }

        query = query.order(sortBy, { ascending: false, nullsLast: true });

        const { data, error } = await query;
        
        if (error) {
          if (error.message.includes('timeout') || error.message.includes('57014')) {
            throw new Error('Search took too long. Please try a more specific search term.');
          }
          throw error;
        }

        return data || [];
      } catch (error) {
        console.error('Query error:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    {
      keepPreviousData: true,
      refetchInterval: 30000,
      enabled: !connectionError,
      retry: (failureCount, error) => {
        if (error?.message?.includes('timeout')) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 30000,
      cacheTime: 60000
    }
  );

  const analyzeMutation = useMutation(
    async (domain: string) => {
      try {
        return await analyzeDomain(domain, (progress) => {
          const domainData = domainsQuery.data?.find(d => d.domain === domain);
          if (domainData) {
            setAnalysisProgress(prev => ({
              ...prev,
              [domainData.id]: progress
            }));
          }
        });
      } catch (error) {
        console.error('Analysis failed:', error);
        throw error;
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['domains', search, minTraffic, sortBy]);
      },
      onError: (error) => {
        console.error('Analysis failed:', error);
      },
      retry: 2,
      retryDelay: 1000
    }
  );

  const handleRefresh = async (domain: string) => {
    if (analyzeMutation.isLoading) return;
    await analyzeMutation.mutateAsync(domain);
  };

  const getStatusIcon = (domain: Domain) => {
    if (domain.status === 'available') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (domain.status === 'registered') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  };

  const getTrafficScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Database Connection Error</h2>
          <p className="text-gray-600">Unable to connect to the database. Please check your configuration.</p>
        </div>
      </div>
    );
  }

  if (domainsQuery.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Data</h2>
          <p className="text-gray-600">{domainsQuery.error instanceof Error ? domainsQuery.error.message : 'An error occurred while fetching data'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-600" />
            Domain Traffic Analyzer
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form className="bg-white rounded-lg shadow p-6 mb-8" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="domain-search" className="block text-sm font-medium text-gray-700">
                Search Domains
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="domain-search"
                  name="domain-search"
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter domain name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search domains"
                />
              </div>
            </div>
            <div className="lg:w-48">
              <label htmlFor="min-traffic" className="block text-sm font-medium text-gray-700">
                Minimum Monthly Traffic
              </label>
              <select
                id="min-traffic"
                name="min-traffic"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={minTraffic}
                onChange={(e) => setMinTraffic(Number(e.target.value))}
              >
                <option value="0">Any traffic</option>
                <option value="100">100+ monthly visits</option>
                <option value="1000">1,000+ monthly visits</option>
                <option value="5000">5,000+ monthly visits</option>
                <option value="10000">10,000+ monthly visits</option>
              </select>
            </div>
            <div className="lg:w-48">
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">
                Sort By
              </label>
              <select
                id="sort-by"
                name="sort-by"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="traffic_score">Traffic Score</option>
                <option value="estimated_traffic">Estimated Traffic</option>
                <option value="indexed_pages">Indexed Pages</option>
              </select>
            </div>
          </div>
        </form>

        {domainsQuery.isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading domains...</p>
          </div>
        ) : domainsQuery.data?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No domains found matching your criteria.</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {domainsQuery.data?.map((domain) => (
                <li key={domain.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(domain)}
                          <h3 className="text-lg font-medium text-indigo-600 truncate">
                            {domain.domain}
                          </h3>
                        </div>
                        <div className="mt-2 flex flex-col sm:flex-row sm:gap-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <Users className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                            <span>{domain.estimated_traffic?.toLocaleString() ?? 0} monthly visits</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Globe className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                            <span>{domain.indexed_pages?.toLocaleString() ?? 0} indexed pages</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Mail className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                            <span>Mail Score: {domain.mail_score?.toFixed(1) ?? 0}</span>
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Archive className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                            <span>{domain.archive_snapshots ?? 0} archive snapshots</span>
                          </div>
                        </div>
                        {domain.has_redirect && (
                          <div className="mt-2 text-sm text-gray-500">
                            <span className="font-medium">Redirects to:</span> {domain.redirect_url}
                          </div>
                        )}
                        {analysisProgress[domain.id] && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${analysisProgress[domain.id].progress}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500">
                                {analysisProgress[domain.id].message}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTrafficScoreColor(domain.traffic_score)}`}>
                            Score: {domain.traffic_score ?? 0}
                          </span>
                          <button
                            onClick={() => handleRefresh(domain.domain)}
                            disabled={analyzeMutation.isLoading}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Analyze domain"
                            aria-label={`Analyze ${domain.domain}`}
                          >
                            <RefreshCw className={`h-4 w-4 ${analyzeMutation.isLoading ? 'animate-spin' : ''}`} />
                          </button>
                          <a
                            href={`https://www.namecheap.com/domains/registration/results/?domain=${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            aria-label={`Register ${domain.domain}`}
                          >
                            Register
                            <ArrowUpRight className="ml-1 -mr-0.5 h-4 w-4" />
                          </a>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Last checked: {domain.last_checked ? new Date(domain.last_checked).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;