module.exports = function (grunt) {
    
        // Project configuration.
        grunt.initConfig({
            pkg: grunt.file.readJSON('package.json'),
            concat: {
                options: {
                    banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
                    separator: ';\n',
                    footer: '',
                    stripBanners: true,
                    process: false,
                    sourceMap: false
                },
                dist: {
                    src: ['public/app/scripts/<%= pkg.name%>.js', 'public/app/scripts/**/*.js', '!public/app/scripts/login.js'],
                    dest: 'public/dist/<%= pkg.name%>.js'
                }
            },
            uglify: {
                options: {
                    banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
                },
                build: {
                    src: 'public/dist/<%= pkg.name %>.js',
                    dest: 'public/dist/<%= pkg.name %>.min.js'
                }
            },
            watch: {
                scripts: {
                    files: ['public/app/scripts/<%= pkg.name%>.js', 'public/app/scripts/**/*.js'],
                    tasks: ['concat', 'uglify'],
                    options: {
                        interval: 1000
                    }
                }
            }
        });
    
        // Load the plugin that provides the "uglify" task.
        grunt.loadNpmTasks('grunt-contrib-concat');
        grunt.loadNpmTasks('grunt-contrib-uglify');
        grunt.loadNpmTasks('grunt-contrib-watch');
        
        // Default task(s).
        grunt.registerTask('default', ['concat', 'uglify']);
    
    };