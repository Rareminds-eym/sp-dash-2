'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';

const CLIENT_TYPES = [
  { value: 'school_student', label: 'School Student' },
  { value: 'college_student', label: 'College Student' },
  { value: 'learner', label: 'Learner' },
  { value: 'school_educator', label: 'School Educator' },
  { value: 'college_educator', label: 'College Educator' },
  { value: 'school_admin', label: 'School Admin' },
  { value: 'college_admin', label: 'College Admin' },
  { value: 'university_admin', label: 'University Admin' },
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'recruiter', label: 'Recruiter' },
];

export function ClientTypeFilter({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (type) => {
    const newValue = value.includes(type)
      ? value.filter((t) => t !== type)
      : [...value, type];
    onChange(newValue);
  };

  const displayText = value.length === 0
    ? 'Client Type'
    : value.length === 1
    ? CLIENT_TYPES.find(t => t.value === value[0])?.label
    : `${value.length} selected`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label="Filter by client type"
          className="w-full justify-between h-10 font-normal"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {CLIENT_TYPES.map((type) => (
            <div
              key={type.value}
              className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => handleToggle(type.value)}
            >
              <Checkbox
                checked={value.includes(type.value)}
                onCheckedChange={() => handleToggle(type.value)}
                aria-label={`Select ${type.label}`}
              />
              <span className="text-sm">{type.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}