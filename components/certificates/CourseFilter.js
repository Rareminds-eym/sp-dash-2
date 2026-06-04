'use client';

import PropTypes from 'prop-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CourseFilter({ value, onChange, courses, isLoading }) {
  return (
    <Select 
      value={value || 'all'} 
      onValueChange={(val) => onChange(val === 'all' ? '' : val)}
      disabled={isLoading}
    >
      <SelectTrigger 
        id="course-filter"
        className="w-full h-10"
        aria-label="Filter by course"
      >
        <SelectValue placeholder="Course" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Courses</SelectItem>
        {courses.map((course) => (
          <SelectItem key={course.id} value={course.id}>
            {course.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

CourseFilter.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  courses: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })),
  isLoading: PropTypes.bool,
};

CourseFilter.defaultProps = {
  value: '',
  courses: [],
  isLoading: false,
};