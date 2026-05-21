CREATE DATABASE IF NOT EXISTS u939623996_joyson;\nUSE u939623996_joyson;\n\nCREATE TABLE `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `EmployeeCode` varchar(50) DEFAULT NULL,
  `Date` date DEFAULT NULL,
  `Status` enum('Present','Absent','Leave','HalfDay') DEFAULT 'Present',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16851 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `daily_required_manpower` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `department` varchar(100) DEFAULT '',
  `section` varchar(100) DEFAULT '',
  `line` varchar(100) DEFAULT '',
  `required_count` int(11) NOT NULL DEFAULT 0,
  `req_l0` int(11) NOT NULL DEFAULT 0,
  `req_l1` int(11) NOT NULL DEFAULT 0,
  `req_l2` int(11) NOT NULL DEFAULT 0,
  `req_l3` int(11) NOT NULL DEFAULT 0,
  `req_l4` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_daily_req` (`date`,`department`,`section`,`line`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `dailymanpowerstats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `total_required` int(11) DEFAULT 0,
  `actual_available` int(11) DEFAULT 0,
  `buffer` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `departmentwiseskill` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `EmployeeGroup` char(10) DEFAULT NULL,
  `DepartmentCode` varchar(50) DEFAULT NULL,
  `StationType` varchar(100) DEFAULT NULL,
  `Shift` char(10) DEFAULT NULL,
  `Skill` enum('L0','L1','L2','L3','L4') DEFAULT NULL,
  `IndentManpower` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `employeemap` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `PlantCode` varchar(50) DEFAULT NULL,
  `EmployeeCode` varchar(50) DEFAULT NULL,
  `LineMachine` varchar(100) DEFAULT NULL,
  `Station` varchar(100) DEFAULT NULL,
  `StationType` varchar(100) DEFAULT NULL,
  `Skill` enum('L0','L1','L2','L3','L4') DEFAULT NULL,
  `Groupleader` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=357 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `headcountdataneemranaplant` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Entity` varchar(100) DEFAULT NULL,
  `EmpID` varchar(50) DEFAULT NULL,
  `EmployeeName` varchar(100) DEFAULT NULL,
  `Gender` enum('Male','Female') DEFAULT NULL,
  `DivisionPlant` varchar(100) DEFAULT NULL,
  `Department` varchar(100) DEFAULT NULL,
  `Section` varchar(100) DEFAULT NULL,
  `ActiveLeft` enum('Active','Left') DEFAULT NULL,
  `Category` varchar(50) DEFAULT NULL,
  `DateOfJoin` date DEFAULT NULL,
  `DateOfLeaving` date DEFAULT NULL,
  `IsDojo` tinyint(1) DEFAULT 0,
  `DojoCertifiedDate` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=580 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `linemaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `PlantCode` varchar(50) DEFAULT NULL,
  `Line` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `updstationmaster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `PlantCode` varchar(50) DEFAULT NULL,
  `Line` varchar(100) DEFAULT NULL,
  `Station` varchar(100) DEFAULT NULL,
  `stationType` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=218 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\nCREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;\n\n