import React, { useEffect } from 'react';
import { TIME_DISPLAY_OPTIONS, TimeOption, TIMER_OPTIONS } from './utils/constants';

export function TestConstants() {
  useEffect(() => {
    console.log('TIME_DISPLAY_OPTIONS:', TIME_DISPLAY_OPTIONS);
    console.log('TIMER_OPTIONS:', TIMER_OPTIONS);
  }, []);
  
  const options: TimeOption[] = ['THREE_MIN', 'FIVE_MIN', 'TEN_MIN'];
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Time Control Options Test</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">Available Time Options:</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 border-b">Option Key</th>
                <th className="py-2 px-4 border-b">Display Label</th>
                <th className="py-2 px-4 border-b">Value (ms)</th>
                <th className="py-2 px-4 border-b">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {TIME_DISPLAY_OPTIONS.map(option => (
                <tr key={option.value} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{option.value}</td>
                  <td className="py-2 px-4 border-b">{option.label}</td>
                  <td className="py-2 px-4 border-b">{TIMER_OPTIONS[option.value as TimeOption]}</td>
                  <td className="py-2 px-4 border-b">{TIMER_OPTIONS[option.value as TimeOption] / 60000}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Raw Data (Check Console):</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
          {`TIME_DISPLAY_OPTIONS: ${JSON.stringify(TIME_DISPLAY_OPTIONS, null, 2)}\n\nTIMER_OPTIONS: ${JSON.stringify(TIMER_OPTIONS, null, 2)}`}
        </pre>
      </div>
    </div>
  );
}

export default TestConstants; 